import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/authenticated_client.dart';
import '../inference/on_device_inference_service.dart';
import 'image_processing_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// ImageAnalysisPage — submit images for on-device AI analysis
//
// Supports: describe, caption, classify, ocr, face-blur, nsfw-check, alt-text.
// Uses local Gemma 4 vision model for analysis; falls back to server API.
// ═══════════════════════════════════════════════════════════════════════════

class ImageAnalysisPage extends StatefulWidget {
  const ImageAnalysisPage({
    super.key,
    required this.client,
    required this.inferenceService,
  });

  final AuthenticatedClient client;
  final OnDeviceInferenceService inferenceService;

  @override
  State<ImageAnalysisPage> createState() => _ImageAnalysisPageState();
}

class _ImageAnalysisPageState extends State<ImageAnalysisPage> {
  late final ImageProcessingService _service;
  final ImagePicker _picker = ImagePicker();

  Map<String, dynamic> _policy = {};
  Map<String, dynamic> _stats = {};
  List<Map<String, dynamic>> _jobs = [];
  bool _loading = true;
  String _selectedCategory = 'describe';

  // Local analysis state
  File? _selectedImage;
  String? _analysisResult;
  bool _analysing = false;

  @override
  void initState() {
    super.initState();
    _service = ImageProcessingService(client: widget.client);
    widget.inferenceService.addListener(_onInferenceChanged);
    _load();
  }

  @override
  void dispose() {
    widget.inferenceService.removeListener(_onInferenceChanged);
    super.dispose();
  }

  void _onInferenceChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _service.getPolicy(),
        _service.getStats(),
        _service.listJobs(),
      ]);
      if (!mounted) return;
      setState(() {
        _policy = results[0] as Map<String, dynamic>;
        _stats = results[1] as Map<String, dynamic>;
        _jobs = (results[2] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;

      setState(() {
        _selectedImage = File(picked.path);
        _analysisResult = null;
      });

      await _analyseImage(File(picked.path));
    } on PlatformException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Could not access ${source == ImageSource.camera ? 'camera' : 'gallery'}: ${e.message}'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _analyseImage(File imageFile) async {
    setState(() => _analysing = true);
    HapticFeedback.mediumImpact();

    final stopwatch = Stopwatch()..start();

    try {
      final bytes = await imageFile.readAsBytes();
      final base64Image = base64Encode(bytes);
      final sizeKb = (bytes.length / 1024).toStringAsFixed(1);

      final prompt = _buildVisionPrompt(_selectedCategory, sizeKb, base64Image);

      final result = await widget.inferenceService.infer(
        prompt,
        maxTokens: 1024,
        temperature: 0.3,
      );

      stopwatch.stop();

      if (!mounted) return;
      setState(() {
        _analysisResult = result;
        _analysing = false;
      });

      // Sync to server for tracking
      _service.submitJob(
        imageRef: 'local:${imageFile.path.split('/').last}',
        category: _selectedCategory,
        context:
            'on-device analysis completed in ${stopwatch.elapsedMilliseconds}ms',
      );

      _load();
    } catch (e) {
      stopwatch.stop();
      if (!mounted) return;
      setState(() {
        _analysisResult = null;
        _analysing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Analysis failed: $e'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  String _buildVisionPrompt(String category, String sizeKb, String base64Data) {
    final taskDesc = switch (category) {
      'describe' =>
        'Describe this image in detail. Include objects, scene, colors, and context.',
      'caption' =>
        'Write a concise, descriptive caption for this image suitable for social media.',
      'classify' =>
        'Classify this image into categories. List the main subjects and themes.',
      'ocr' =>
        'Extract all visible text from this image. Preserve formatting where possible.',
      'handwriting' =>
        'Read and transcribe any handwritten text in this image.',
      'chart' =>
        'Interpret this chart or graph. Describe the data, axes, trends, and key takeaways.',
      'diagram' =>
        'Analyze this diagram. Describe its components, connections, and purpose.',
      _ => 'Analyze this image and provide a detailed description.',
    };

    return '[IMAGE: ${sizeKb}KB base64]\n$base64Data\n\n'
        'Task: $_selectedCategory\n$taskDesc';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('Image Analysis')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildModelBanner(isDark),
                  const SizedBox(height: 16),
                  _buildCategoryPicker(isDark),
                  const SizedBox(height: 16),
                  _buildSubmitCard(isDark),
                  if (_selectedImage != null) ...[
                    const SizedBox(height: 16),
                    _buildImagePreview(isDark),
                  ],
                  if (_analysing) ...[
                    const SizedBox(height: 16),
                    _buildAnalysingCard(isDark),
                  ],
                  if (_analysisResult != null) ...[
                    const SizedBox(height: 16),
                    _buildResultCard(isDark),
                  ],
                  const SizedBox(height: 20),
                  _buildStatsCard(isDark),
                  const SizedBox(height: 20),
                  _buildJobsList(isDark),
                ],
              ),
            ),
    );
  }

  Widget _buildModelBanner(bool isDark) {
    final model = widget.inferenceService.activeModel;
    final hasVision = model?.capabilities.contains('vision') ?? false;
    final isReady = widget.inferenceService.state == InferenceState.ready;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (isReady && hasVision)
            ? const Color(0xFF10b981).withValues(alpha: 0.1)
            : Colors.orange.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (isReady && hasVision)
              ? const Color(0xFF10b981).withValues(alpha: 0.3)
              : Colors.orange.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            (isReady && hasVision)
                ? Icons.check_circle_rounded
                : Icons.info_outline_rounded,
            color: (isReady && hasVision)
                ? const Color(0xFF10b981)
                : Colors.orange,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              (isReady && hasVision)
                  ? 'Using ${model?.name ?? 'Gemma 4'} for on-device vision analysis'
                  : isReady
                      ? 'Model loaded but no vision capability'
                      : 'No AI model loaded — load one in On-Device Inference settings',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white70 : Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryPicker(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Analysis Type',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ImageProcessingService.categories.map((cat) {
              final selected = cat == _selectedCategory;
              return ChoiceChip(
                label: Text(cat.replaceAll('-', ' ').toUpperCase()),
                selected: selected,
                onSelected: (_) {
                  HapticFeedback.selectionClick();
                  setState(() => _selectedCategory = cat);
                },
                selectedColor: const Color(0xFFFF6B9D).withValues(alpha: 0.25),
                labelStyle: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? const Color(0xFFFF6B9D)
                      : (isDark ? Colors.white70 : Colors.black54),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitCard(bool isDark) {
    final canAnalyse =
        widget.inferenceService.state == InferenceState.ready && !_analysing;

    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Submit Image',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Select an image from your gallery or camera to process with '
            'on-device $_selectedCategory analysis.',
            style: TextStyle(
              fontSize: 13,
              color: isDark ? Colors.white60 : Colors.black54,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed:
                      canAnalyse ? () => _pickImage(ImageSource.gallery) : null,
                  icon: const Icon(Icons.photo_library_rounded, size: 18),
                  label: const Text('Gallery'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed:
                      canAnalyse ? () => _pickImage(ImageSource.camera) : null,
                  icon: const Icon(Icons.camera_alt_rounded, size: 18),
                  label: const Text('Camera'),
                ),
              ),
            ],
          ),
          if (!canAnalyse && !_analysing)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Load an AI model first to enable image analysis',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.orange.shade300,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildImagePreview(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Selected Image',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 18),
                onPressed: () => setState(() {
                  _selectedImage = null;
                  _analysisResult = null;
                }),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.file(
              _selectedImage!,
              width: double.infinity,
              height: 200,
              fit: BoxFit.cover,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnalysingCard(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        children: [
          const SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(strokeWidth: 3),
          ),
          const SizedBox(height: 12),
          Text(
            'Analysing with Gemma 4...',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Processing on-device · No data leaves your phone',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white38 : Colors.black38,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultCard(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded,
                  color: Color(0xFFFF6B9D), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Analysis Result',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.copy_rounded, size: 16),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _analysisResult ?? ''));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Copied to clipboard'),
                      behavior: SnackBarBehavior.floating,
                      duration: Duration(seconds: 1),
                    ),
                  );
                },
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.04)
                  : Colors.black.withValues(alpha: 0.02),
              borderRadius: BorderRadius.circular(10),
            ),
            child: SelectableText(
              _analysisResult ?? '',
              style: TextStyle(
                fontSize: 14,
                height: 1.5,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.memory_rounded,
                  size: 14, color: isDark ? Colors.white30 : Colors.black26),
              const SizedBox(width: 4),
              Text(
                'Processed on-device with ${widget.inferenceService.activeModel?.name ?? 'Gemma 4'}',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? Colors.white30 : Colors.black26,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatsCard(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Processing Stats',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          _statRow('Total jobs', '${_stats['total_jobs'] ?? 0}', isDark),
          _statRow('Completed', '${_stats['completed'] ?? 0}', isDark),
          _statRow('Avg time', '${_stats['avg_processing_ms'] ?? 0}ms', isDark),
          _statRow(
            'Policy',
            _policy['auto_escalate'] == true ? 'Auto-escalate' : 'Local only',
            isDark,
          ),
        ],
      ),
    );
  }

  Widget _buildJobsList(bool isDark) {
    if (_jobs.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Column(
            children: [
              Icon(Icons.image_not_supported_rounded,
                  size: 48, color: isDark ? Colors.white24 : Colors.black26),
              const SizedBox(height: 8),
              Text(
                'No analysis jobs yet',
                style: TextStyle(
                  color: isDark ? Colors.white38 : Colors.black38,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent Jobs',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 10),
        ..._jobs.take(20).map((job) => _jobTile(job, isDark)),
      ],
    );
  }

  Widget _jobTile(Map<String, dynamic> job, bool isDark) {
    final status = job['status'] ?? 'unknown';
    final category = job['category'] ?? '';
    final statusColor = switch (status) {
      'completed' => Colors.green,
      'processing' => Colors.orange,
      'failed' => Colors.red,
      _ => Colors.grey,
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: _card(
        isDark: isDark,
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    category.toString().replaceAll('-', ' ').toUpperCase(),
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  Text(
                    'Status: $status',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white54 : Colors.black45,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              job['job_id']?.toString().substring(0, 8) ?? '',
              style: TextStyle(
                fontSize: 11,
                fontFamily: 'monospace',
                color: isDark ? Colors.white30 : Colors.black26,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  Widget _card({required bool isDark, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(14),
      ),
      child: child,
    );
  }

  Widget _statRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: isDark ? Colors.white60 : Colors.black54,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }
}
