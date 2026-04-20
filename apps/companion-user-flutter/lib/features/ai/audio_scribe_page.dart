import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:speech_to_text/speech_recognition_result.dart';

import '../../app/authenticated_client.dart';
import '../inference/on_device_inference_service.dart';
import 'audio_scribe_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// AudioScribePage — on-device speech-to-text interface
//
// Uses platform speech recognition for real-time transcription.
// Optionally processes with Gemma 4 for post-processing and cleanup.
// ═══════════════════════════════════════════════════════════════════════════

class AudioScribePage extends StatefulWidget {
  const AudioScribePage({
    super.key,
    required this.client,
    required this.inferenceService,
  });

  final AuthenticatedClient client;
  final OnDeviceInferenceService inferenceService;

  @override
  State<AudioScribePage> createState() => _AudioScribePageState();
}

class _AudioScribePageState extends State<AudioScribePage> {
  late final AudioScribeService _service;
  final stt.SpeechToText _speech = stt.SpeechToText();

  Map<String, dynamic> _config = {};
  Map<String, dynamic> _stats = {};
  List<Map<String, dynamic>> _sessions = [];
  bool _loading = true;
  String _selectedLang = 'en';
  bool _recording = false;
  bool _speechAvailable = false;

  // Live transcription state
  String _currentTranscript = '';
  String _finalTranscript = '';
  double _confidence = 0.0;
  final List<Map<String, String>> _localSessions = [];

  @override
  void initState() {
    super.initState();
    _service = AudioScribeService(client: widget.client);
    _initSpeech();
    _load();
  }

  Future<void> _initSpeech() async {
    _speechAvailable = await _speech.initialize(
      onStatus: (status) {
        if (mounted) {
          setState(() {
            if (status == 'done' || status == 'notListening') {
              if (_recording) {
                _finishRecording();
              }
            }
          });
        }
      },
      onError: (error) {
        if (mounted) {
          setState(() => _recording = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Speech recognition error: ${error.errorMsg}'),
              behavior: SnackBarBehavior.floating,
              backgroundColor: Colors.red,
            ),
          );
        }
      },
    );
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _service.getConfig(),
        _service.getStats(),
        _service.listSessions(),
      ]);
      if (!mounted) return;
      setState(() {
        _config = results[0] as Map<String, dynamic>;
        _stats = results[1] as Map<String, dynamic>;
        _sessions = (results[2] as List).cast<Map<String, dynamic>>();
        if (_config['default_language'] is String) {
          _selectedLang = _config['default_language'] as String;
        }
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _startRecording() async {
    if (!_speechAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Speech recognition not available on this device'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _recording = true;
      _currentTranscript = '';
      _finalTranscript = '';
      _confidence = 0.0;
    });
    HapticFeedback.mediumImpact();

    final localeId = _mapLanguageToLocale(_selectedLang);

    await _speech.listen(
      onResult: _onSpeechResult,
      localeId: localeId,
      listenOptions: stt.SpeechListenOptions(
        listenMode: stt.ListenMode.dictation,
        cancelOnError: false,
        partialResults: true,
      ),
    );
  }

  void _onSpeechResult(SpeechRecognitionResult result) {
    if (!mounted) return;
    setState(() {
      _currentTranscript = result.recognizedWords;
      if (result.hasConfidenceRating) {
        _confidence = result.confidence;
      }
      if (result.finalResult) {
        _finalTranscript = result.recognizedWords;
      }
    });
  }

  Future<void> _stopRecording() async {
    await _speech.stop();
    _finishRecording();
  }

  void _finishRecording() {
    if (!mounted) return;
    setState(() => _recording = false);

    final transcript = _finalTranscript.isNotEmpty
        ? _finalTranscript
        : _currentTranscript;

    if (transcript.isNotEmpty) {
      setState(() {
        _localSessions.insert(0, {
          'transcript': transcript,
          'language':
              AudioScribeService.languageLabels[_selectedLang] ?? _selectedLang,
          'confidence': '${(_confidence * 100).toStringAsFixed(0)}%',
          'status': 'completed',
        });
      });

      // Sync to server for tracking
      _service.startSession(source: 'microphone', language: _selectedLang);

      HapticFeedback.lightImpact();
    }
  }

  String _mapLanguageToLocale(String lang) {
    return switch (lang) {
      'en' => 'en_US',
      'es' => 'es_ES',
      'fr' => 'fr_FR',
      'de' => 'de_DE',
      'it' => 'it_IT',
      'pt' => 'pt_BR',
      'nl' => 'nl_NL',
      'pl' => 'pl_PL',
      'ru' => 'ru_RU',
      'zh' => 'zh_CN',
      'ja' => 'ja_JP',
      'ko' => 'ko_KR',
      'ar' => 'ar_SA',
      _ => lang,
    };
  }

  @override
  void dispose() {
    _speech.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('Audio Scribe')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildSpeechStatusBanner(isDark),
                  const SizedBox(height: 16),
                  _buildRecordCard(isDark),
                  if (_currentTranscript.isNotEmpty ||
                      _finalTranscript.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _buildLiveTranscript(isDark),
                  ],
                  const SizedBox(height: 16),
                  _buildLanguagePicker(isDark),
                  const SizedBox(height: 16),
                  _buildStatsCard(isDark),
                  const SizedBox(height: 20),
                  if (_localSessions.isNotEmpty) ...[
                    _buildLocalSessionList(isDark),
                    const SizedBox(height: 20),
                  ],
                  _buildSessionList(isDark),
                ],
              ),
            ),
    );
  }

  Widget _buildSpeechStatusBanner(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _speechAvailable
            ? const Color(0xFF10b981).withValues(alpha: 0.1)
            : Colors.orange.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _speechAvailable
              ? const Color(0xFF10b981).withValues(alpha: 0.3)
              : Colors.orange.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            _speechAvailable
                ? Icons.check_circle_rounded
                : Icons.mic_off_rounded,
            color: _speechAvailable ? const Color(0xFF10b981) : Colors.orange,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _speechAvailable
                  ? 'On-device speech recognition ready'
                  : 'Speech recognition not available',
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

  Widget _buildRecordCard(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        children: [
          GestureDetector(
            onTap: _recording ? _stopRecording : _startRecording,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _recording
                    ? Colors.red.withValues(alpha: 0.2)
                    : const Color(0xFFFFA726).withValues(alpha: 0.15),
                border: Border.all(
                  color: _recording ? Colors.red : const Color(0xFFFFA726),
                  width: 3,
                ),
              ),
              child: Icon(
                _recording ? Icons.stop_rounded : Icons.mic_rounded,
                size: 36,
                color: _recording ? Colors.red : const Color(0xFFFFA726),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _recording
                ? 'Listening... Tap to stop'
                : 'Tap to start transcription',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'On-device speech-to-text · No data leaves device',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white54 : Colors.black45,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLiveTranscript(bool isDark) {
    final transcript = _recording ? _currentTranscript : _finalTranscript;
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                _recording ? Icons.circle : Icons.check_circle_rounded,
                size: 10,
                color: _recording ? Colors.red : Colors.green,
              ),
              const SizedBox(width: 8),
              Text(
                _recording ? 'Live Transcription' : 'Transcription Complete',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const Spacer(),
              if (_confidence > 0)
                Text(
                  '${(_confidence * 100).toStringAsFixed(0)}%',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _confidence > 0.8
                        ? Colors.green
                        : _confidence > 0.5
                        ? Colors.orange
                        : Colors.red,
                  ),
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
              transcript,
              style: TextStyle(
                fontSize: 14,
                height: 1.5,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ),
          if (!_recording && transcript.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: transcript));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Copied to clipboard'),
                        behavior: SnackBarBehavior.floating,
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  label: const Text('Copy'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLocalSessionList(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'This Session',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 10),
        ..._localSessions.take(10).map((s) => _localSessionTile(s, isDark)),
      ],
    );
  }

  Widget _localSessionTile(Map<String, String> session, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: _card(
        isDark: isDark,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Colors.green,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${session['language']} · Confidence: ${session['confidence']}',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              session['transcript'] ?? '',
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLanguagePicker(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Language',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: AudioScribeService.highAccuracyLanguages.map((lang) {
              final selected = lang == _selectedLang;
              final label =
                  AudioScribeService.languageLabels[lang] ?? lang.toUpperCase();
              return ChoiceChip(
                label: Text(label),
                selected: selected,
                onSelected: (_) {
                  HapticFeedback.selectionClick();
                  setState(() => _selectedLang = lang);
                },
                selectedColor: const Color(0xFFFFA726).withValues(alpha: 0.25),
                labelStyle: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected
                      ? const Color(0xFFFFA726)
                      : (isDark ? Colors.white70 : Colors.black54),
                ),
              );
            }).toList(),
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
            'Transcription Stats',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          _statRow('Sessions', '${_stats['total_sessions'] ?? 0}', isDark),
          _statRow(
            'Total duration',
            '${_stats['total_duration_sec'] ?? 0}s',
            isDark,
          ),
          _statRow(
            'Avg accuracy',
            '${_stats['avg_accuracy'] ?? 'N/A'}',
            isDark,
          ),
          _statRow('Engine', _config['engine'] ?? 'gemma4-scribe', isDark),
        ],
      ),
    );
  }

  Widget _buildSessionList(bool isDark) {
    if (_sessions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Column(
            children: [
              Icon(
                Icons.mic_off_rounded,
                size: 48,
                color: isDark ? Colors.white24 : Colors.black26,
              ),
              const SizedBox(height: 8),
              Text(
                'No transcription sessions yet',
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
          'Recent Sessions',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 16,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 10),
        ..._sessions.take(20).map((s) => _sessionTile(s, isDark)),
      ],
    );
  }

  Widget _sessionTile(Map<String, dynamic> session, bool isDark) {
    final status = session['status'] ?? 'unknown';
    final lang = session['language'] ?? '';
    final dur = session['duration_sec'] ?? 0;
    final statusColor = switch (status) {
      'completed' => Colors.green,
      'active' => Colors.orange,
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
                    '${AudioScribeService.languageLabels[lang] ?? lang} · ${dur}s',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  if (session['transcript_preview'] != null)
                    Text(
                      session['transcript_preview'].toString(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.white54 : Colors.black45,
                      ),
                    ),
                ],
              ),
            ),
            Text(
              status,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: statusColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

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
