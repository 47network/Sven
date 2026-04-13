import 'package:flutter/material.dart';

import 'on_device_inference_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// InferencePage — model management UI for on-device Gemma 4 inference
//
// Shows installed models, available variants, download/install controls,
// performance stats, and privacy guarantee badge.
// ═══════════════════════════════════════════════════════════════════════════

class InferencePage extends StatefulWidget {
  const InferencePage({super.key, required this.inferenceService});

  final OnDeviceInferenceService inferenceService;

  @override
  State<InferencePage> createState() => _InferencePageState();
}

class _InferencePageState extends State<InferencePage> {
  OnDeviceInferenceService get _service => widget.inferenceService;

  @override
  void initState() {
    super.initState();
    _service.addListener(_rebuild);
    _service.fetchAvailableModules();
  }

  @override
  void dispose() {
    _service.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('On-Device AI')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildPrivacyBanner(isDark),
          const SizedBox(height: 16),
          _buildDeviceInfo(isDark),
          const SizedBox(height: 16),
          _buildModelSection(isDark),
          const SizedBox(height: 16),
          if (_service.installedModels.isNotEmpty) ...[
            _buildPerformanceSection(isDark),
            const SizedBox(height: 16),
          ],
          _buildSettingsSection(isDark),
          const SizedBox(height: 16),
          if (_service.availableModules.isNotEmpty) ...[
            _buildModulesSection(isDark),
          ],
        ],
      ),
    );
  }

  // ── Privacy banner ─────────────────────────────────────────────────────

  Widget _buildPrivacyBanner(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF10b981).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: const Color(0xFF10b981).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.shield, color: Color(0xFF10b981), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'On-device inference never sends data to external servers. '
              'Your prompts and responses stay on this device.',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white70 : Colors.black54,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Device info ────────────────────────────────────────────────────────

  Widget _buildDeviceInfo(bool isDark) {
    final cap = _service.deviceCapability;
    return _card(
      isDark,
      title: 'Device',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _infoRow('Supported', _service.isSupported ? 'Yes' : 'No', isDark),
          if (cap != null) ...[
            _infoRow('RAM', cap.ramLabel, isDark),
            _infoRow('Free Storage', cap.storageLabel, isDark),
          ],
          _infoRow(
            'Recommended model',
            _service.recommendedVariant.displayName,
            isDark,
          ),
          _infoRow(
            'Status',
            _service.state.name.toUpperCase(),
            isDark,
            valueColor: _stateColor(_service.state),
          ),
          if (_service.error != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                _service.error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }

  // ── Model management ──────────────────────────────────────────────────

  Widget _buildModelSection(bool isDark) {
    return _card(
      isDark,
      title: 'Models',
      child: Column(
        children: [
          // Installed models
          for (final model in _service.installedModels) ...[
            _modelTile(model, isDark),
            if (model != _service.installedModels.last)
              Divider(
                height: 1,
                color: isDark ? Colors.white12 : Colors.black12,
              ),
          ],

          // Available to install
          for (final variant in ModelVariant.values)
            if (!_service.installedModels
                .any((m) => m.variant == variant)) ...[
              Builder(builder: (context) {
                final compat = _service.checkCompatibility(variant);
                final isCompatible =
                    compat == ModelCompatibility.compatible ||
                    compat == ModelCompatibility.unknown;
                final isRecommended =
                    variant == _service.recommendedVariant;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Row(
                    children: [
                      Text(
                        variant.displayName,
                        style: TextStyle(
                          color: isCompatible
                              ? (isDark ? Colors.white54 : Colors.black45)
                              : (isDark ? Colors.white24 : Colors.black26),
                        ),
                      ),
                      const SizedBox(width: 6),
                      if (isRecommended && isCompatible)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10b981).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Recommended',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF10b981),
                            ),
                          ),
                        ),
                      if (!isCompatible)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFef4444).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            compat == ModelCompatibility.insufficientRam
                                ? 'Needs ${variant.minRamMb ~/ 1024} GB RAM'
                                : 'Insufficient storage',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFef4444),
                            ),
                          ),
                        ),
                    ],
                  ),
                  subtitle: Text(
                    '${_formatBytes(variant.estimatedSizeBytes)} · '
                    '${variant.contextWindow ~/ 1000}K context',
                    style: TextStyle(
                      fontSize: 12,
                      color: isCompatible
                          ? (isDark ? Colors.white38 : Colors.black26)
                          : (isDark ? Colors.white12 : Colors.black12),
                    ),
                  ),
                  trailing: ElevatedButton(
                    onPressed: (!isCompatible ||
                            _service.state == InferenceState.downloading)
                        ? null
                        : () => _showInstallDialog(variant),
                    child: const Text('Details'),
                  ),
                );
              }),
            ],
        ],
      ),
    );
  }

  Widget _modelTile(ModelProfile model, bool isDark) {
    final isActive = _service.activeModel?.id == model.id;
    final isDownloading = model.status == ModelStatus.downloading;
    return Column(
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isActive
                  ? const Color(0xFF3b82f6).withValues(alpha: 0.2)
                  : (isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              isDownloading
                  ? Icons.downloading_rounded
                  : isActive
                      ? Icons.memory
                      : Icons.download_done,
              size: 18,
              color: isDownloading
                  ? const Color(0xFFf59e0b)
                  : isActive
                      ? const Color(0xFF3b82f6)
                      : Colors.grey,
            ),
          ),
          title: Text(
            model.name,
            style: TextStyle(
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          subtitle: Text(
            isDownloading
                ? 'Downloading… ${(_service.downloadProgress * 100).toStringAsFixed(0)}%'
                : '${model.sizeLabel} · ${model.capabilities.join(", ")}',
            style: TextStyle(
              fontSize: 12,
              color: isDownloading
                  ? const Color(0xFFf59e0b)
                  : isDark
                      ? Colors.white54
                      : Colors.black45,
            ),
          ),
          trailing: isDownloading
              ? null
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (!isActive && model.status == ModelStatus.ready)
                      IconButton(
                        icon: const Icon(Icons.play_arrow, size: 20),
                        onPressed: () => _service.loadModel(model.id),
                        tooltip: 'Load',
                      ),
                    if (isActive)
                      IconButton(
                        icon: const Icon(Icons.stop, size: 20, color: Colors.orange),
                        onPressed: _service.unloadModel,
                        tooltip: 'Unload',
                      ),
                    IconButton(
                      icon: Icon(Icons.delete_outline,
                          size: 20, color: Colors.red.shade300),
                      onPressed: () => _service.uninstallModel(model.id),
                      tooltip: 'Remove',
                    ),
                  ],
                ),
        ),
        if (isDownloading)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: _service.downloadProgress,
                minHeight: 4,
                backgroundColor: isDark ? Colors.white10 : Colors.black12,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  Color(0xFF3b82f6),
                ),
              ),
            ),
          ),
      ],
    );
  }

  // ── Performance ────────────────────────────────────────────────────────

  Widget _buildPerformanceSection(bool isDark) {
    return _card(
      isDark,
      title: 'Performance',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _infoRow(
            'Total inferences',
            '${_service.totalInferences}',
            isDark,
          ),
          _infoRow(
            'Last inference',
            '${_service.lastInferenceMs.toStringAsFixed(0)} ms',
            isDark,
          ),
          _infoRow(
            'Avg tokens/sec',
            _service.avgTokensPerSecond > 0
                ? _service.avgTokensPerSecond.toStringAsFixed(1)
                : '—',
            isDark,
          ),
        ],
      ),
    );
  }

  // ── Settings ───────────────────────────────────────────────────────────

  Widget _buildSettingsSection(bool isDark) {
    return _card(
      isDark,
      title: 'Routing',
      child: Column(
        children: [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'Prefer local inference',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            subtitle: Text(
              'Process short prompts on-device when a model is loaded',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
            value: _service.preferLocal,
            onChanged: _service.setPreferLocal,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Max local tokens: ${_service.maxLocalTokens}',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
              ),
            ],
          ),
          Slider(
            value: _service.maxLocalTokens.toDouble(),
            min: 128,
            max: 8192,
            divisions: 16,
            label: '${_service.maxLocalTokens}',
            onChanged: (v) => _service.setMaxLocalTokens(v.round()),
          ),
        ],
      ),
    );
  }

  // ── Modules ────────────────────────────────────────────────────────────

  Widget _buildModulesSection(bool isDark) {
    return _card(
      isDark,
      title: 'Modules',
      child: Column(
        children: _service.availableModules
            .map((m) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    m.name,
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  subtitle: Text(
                    m.description,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white54 : Colors.black45,
                    ),
                  ),
                  trailing: m.installed
                      ? const Icon(Icons.check_circle,
                          color: Color(0xFF10b981), size: 20)
                      : const Icon(Icons.cloud_download_outlined,
                          size: 20),
                ))
            .toList(),
      ),
    );
  }

  // ── Install confirmation dialog ─────────────────────────────────────

  void _showInstallDialog(ModelVariant variant) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final compat = _service.checkCompatibility(variant);
    final isCompatible = compat == ModelCompatibility.compatible ||
        compat == ModelCompatibility.unknown;
    final cap = _service.deviceCapability;

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1e293b) : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFF3b82f6).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.download_rounded,
                  color: Color(0xFF3b82f6), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Gemma 4 ${variant.displayName}',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                variant.description,
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.5,
                  color: isDark ? Colors.white70 : Colors.black54,
                ),
              ),
              const SizedBox(height: 16),
              _dialogInfoRow('Download Size', _formatBytes(variant.estimatedSizeBytes), isDark),
              _dialogInfoRow('Context Window', '${variant.contextWindow ~/ 1000}K tokens', isDark),
              _dialogInfoRow('Minimum RAM', '${variant.minRamMb ~/ 1024} GB', isDark),
              if (cap != null)
                _dialogInfoRow('Your RAM', cap.ramLabel, isDark,
                    valueColor: cap.totalRamMb >= variant.minRamMb
                        ? const Color(0xFF10b981)
                        : const Color(0xFFef4444)),
              if (cap != null)
                _dialogInfoRow('Free Storage', cap.storageLabel, isDark,
                    valueColor: cap.freeStorageMb >=
                            (variant.estimatedSizeBytes / (1024 * 1024)).ceil() + 500
                        ? const Color(0xFF10b981)
                        : const Color(0xFFef4444)),
              const SizedBox(height: 12),

              if (!isCompatible) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFef4444).withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: const Color(0xFFef4444).withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded,
                          color: Color(0xFFef4444), size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          compat == ModelCompatibility.insufficientRam
                              ? 'Your device does not have enough RAM to run this model. '
                                'Try a smaller variant.'
                              : 'Not enough free storage to download this model. '
                                'Free up space or choose a smaller variant.',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? Colors.white60 : Colors.black45,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              Text(
                'Capabilities',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white54 : Colors.black45,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: variant.capabilities.map((cap) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3b82f6).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      cap.replaceAll('_', ' '),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white70 : const Color(0xFF3b82f6),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF10b981).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: const Color(0xFF10b981).withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shield_rounded,
                        color: Color(0xFF10b981), size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Model runs 100% on-device. No data leaves your phone.',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.white60 : Colors.black45,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Cancel',
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
          ),
          FilledButton.icon(
            onPressed: isCompatible
                ? () {
                    Navigator.of(ctx).pop();
                    _service.installModel(variant);
                  }
                : null,
            icon: const Icon(Icons.download_rounded, size: 18),
            label: Text(isCompatible
                ? 'Install ${_formatBytes(variant.estimatedSizeBytes)}'
                : 'Not compatible'),
          ),
        ],
      ),
    );
  }

  Widget _dialogInfoRow(String label, String value, bool isDark,
      {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white54 : Colors.black45,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: valueColor ?? (isDark ? Colors.white : Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  Widget _card(bool isDark,
      {required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1e293b) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, bool isDark,
      {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: valueColor ?? (isDark ? Colors.white : Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  Color _stateColor(InferenceState state) {
    switch (state) {
      case InferenceState.ready:
        return const Color(0xFF10b981);
      case InferenceState.inferring:
        return const Color(0xFF3b82f6);
      case InferenceState.downloading:
      case InferenceState.loading:
        return const Color(0xFFf59e0b);
      case InferenceState.error:
        return const Color(0xFFef4444);
      case InferenceState.idle:
        return Colors.grey;
    }
  }

  String _formatBytes(int bytes) {
    final gb = bytes / 1073741824;
    return gb >= 1.0
        ? '${gb.toStringAsFixed(1)} GB'
        : '${(bytes / 1048576).toStringAsFixed(0)} MB';
  }
}
