import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/authenticated_client.dart';
import '../inference/on_device_inference_service.dart';
import '../brain/brain_service.dart';
import 'image_processing_service.dart';
import 'audio_scribe_service.dart';
import 'device_action_service.dart';
import 'ai_policy_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// AiHubPage — unified entry point for all on-device AI capabilities
//
// Cards for: local inference, brain map, image analysis, audio scribe,
// device actions, smart routing, privacy & modules.
// ═══════════════════════════════════════════════════════════════════════════

class AiHubPage extends StatefulWidget {
  const AiHubPage({
    super.key,
    required this.client,
    required this.inferenceService,
    required this.brainService,
    required this.onNavigate,
  });

  final AuthenticatedClient client;
  final OnDeviceInferenceService inferenceService;
  final BrainService brainService;
  final void Function(String route, BuildContext context) onNavigate;

  @override
  State<AiHubPage> createState() => _AiHubPageState();
}

class _AiHubPageState extends State<AiHubPage> {
  late final ImageProcessingService _imageService;
  late final AudioScribeService _audioService;
  late final DeviceActionService _actionService;
  late final AiPolicyService _policyService;

  Map<String, dynamic> _imageStats = {};
  Map<String, dynamic> _scribeStats = {};
  Map<String, dynamic> _actionStats = {};
  Map<String, dynamic> _routingStats = {};
  Map<String, dynamic> _privacyPolicy = {};
  Map<String, dynamic> _moduleStats = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _imageService = ImageProcessingService(client: widget.client);
    _audioService = AudioScribeService(client: widget.client);
    _actionService = DeviceActionService(client: widget.client);
    _policyService = AiPolicyService(client: widget.client);
    widget.inferenceService.addListener(_rebuild);
    _loadStats();
  }

  @override
  void dispose() {
    widget.inferenceService.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  Future<void> _loadStats() async {
    try {
      final results = await Future.wait([
        _imageService.getStats(),
        _audioService.getStats(),
        _actionService.getStats(),
        _policyService.getRoutingStats(),
        _policyService.getPrivacyPolicy(),
        _policyService.getModuleStats(),
      ]);
      if (!mounted) return;
      setState(() {
        _imageStats = results[0];
        _scribeStats = results[1];
        _actionStats = results[2];
        _routingStats = results[3];
        _privacyPolicy = results[4];
        _moduleStats = results[5];
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Hub'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              setState(() => _loading = true);
              _loadStats();
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadStats,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildPrivacyBanner(isDark),
                  const SizedBox(height: 20),
                  _buildSectionHeader('Core Intelligence', isDark),
                  const SizedBox(height: 12),
                  _buildCoreCards(isDark),
                  const SizedBox(height: 24),
                  _buildSectionHeader('AI Pipelines', isDark),
                  const SizedBox(height: 12),
                  _buildPipelineCards(isDark),
                  const SizedBox(height: 24),
                  _buildSectionHeader('Settings & Privacy', isDark),
                  const SizedBox(height: 12),
                  _buildSettingsCards(isDark),
                  const SizedBox(height: 24),
                  _buildSectionHeader('Advanced', isDark),
                  const SizedBox(height: 12),
                  _buildAdvancedCards(isDark),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  // ── Privacy banner ──────────────────────────────────────────────────────

  Widget _buildPrivacyBanner(bool isDark) {
    final localOnly = _privacyPolicy['local_inference_default'] == true;
    final color = localOnly ? Colors.green : Colors.orange;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(
            localOnly ? Icons.shield_rounded : Icons.cloud_sync_rounded,
            color: color,
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  localOnly ? 'Maximum Privacy Mode' : 'Hybrid Mode',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  localOnly
                      ? 'All AI processing runs on-device. No data leaves your phone.'
                      : 'Smart routing sends complex queries to the cloud when needed.',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white60 : Colors.black54,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Section header ──────────────────────────────────────────────────────

  Widget _buildSectionHeader(String title, bool isDark) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.4,
        color: isDark ? Colors.white : Colors.black87,
      ),
    );
  }

  // ── Core intelligence cards ─────────────────────────────────────────────

  Widget _buildCoreCards(bool isDark) {
    final inf = widget.inferenceService;
    final modelCount = inf.installedModels.length;
    final activeModel = inf.activeModel;

    return Column(
      children: [
        _hubCard(
          isDark: isDark,
          icon: Icons.memory_rounded,
          color: const Color(0xFF00D9FF),
          title: 'On-Device Inference',
          subtitle: activeModel != null
              ? 'Active: ${activeModel.name}'
              : '$modelCount model(s) installed',
          badge: activeModel != null ? 'RUNNING' : null,
          badgeColor: Colors.green,
          onTap: () => widget.onNavigate('inference', context),
        ),
        const SizedBox(height: 10),
        _hubCard(
          isDark: isDark,
          icon: Icons.hub_rounded,
          color: const Color(0xFFAF6BFF),
          title: 'Knowledge Brain',
          subtitle: 'Memory graph & knowledge visualization',
          onTap: () => widget.onNavigate('brain', context),
        ),
      ],
    );
  }

  // ── Pipeline cards ──────────────────────────────────────────────────────

  Widget _buildPipelineCards(bool isDark) {
    final imgTotal = (_imageStats['total_jobs'] as num?)?.toInt() ?? 0;
    final scribeSessions = (_scribeStats['total_sessions'] as num?)?.toInt() ?? 0;
    final actionExecs = (_actionStats['total_executions'] as num?)?.toInt() ?? 0;

    return Column(
      children: [
        _hubCard(
          isDark: isDark,
          icon: Icons.image_search_rounded,
          color: const Color(0xFFFF6B9D),
          title: 'Image Analysis',
          subtitle: imgTotal > 0
              ? '$imgTotal images processed'
              : 'Describe, caption & classify images locally',
          onTap: () => widget.onNavigate('ai/image', context),
        ),
        const SizedBox(height: 10),
        _hubCard(
          isDark: isDark,
          icon: Icons.mic_rounded,
          color: const Color(0xFFFFA726),
          title: 'Audio Scribe',
          subtitle: scribeSessions > 0
              ? '$scribeSessions transcription sessions'
              : 'On-device speech-to-text in 13 languages',
          onTap: () => widget.onNavigate('ai/scribe', context),
        ),
        const SizedBox(height: 10),
        _hubCard(
          isDark: isDark,
          icon: Icons.touch_app_rounded,
          color: const Color(0xFF4CAF50),
          title: 'Device Actions',
          subtitle: actionExecs > 0
              ? '$actionExecs actions executed'
              : 'Control device features with AI',
          onTap: () => widget.onNavigate('ai/actions', context),
        ),
      ],
    );
  }

  // ── Settings & privacy cards ────────────────────────────────────────────

  Widget _buildSettingsCards(bool isDark) {
    final localPct = (_routingStats['local_percentage'] as num?)?.toInt() ?? 0;
    final moduleInstalled = (_moduleStats['installed_count'] as num?)?.toInt() ?? 0;

    return Column(
      children: [
        _hubCard(
          isDark: isDark,
          icon: Icons.route_rounded,
          color: const Color(0xFF42A5F5),
          title: 'Smart Routing',
          subtitle: 'Local: $localPct% · Cloud: ${100 - localPct}%',
          onTap: () => widget.onNavigate('ai/routing', context),
        ),
        const SizedBox(height: 10),
        _hubCard(
          isDark: isDark,
          icon: Icons.extension_rounded,
          color: const Color(0xFFAB47BC),
          title: 'AI Modules',
          subtitle: '$moduleInstalled module(s) installed',
          onTap: () => widget.onNavigate('ai/modules', context),
        ),
        const SizedBox(height: 10),
        _hubCard(
          isDark: isDark,
          icon: Icons.privacy_tip_rounded,
          color: const Color(0xFF26A69A),
          title: 'Privacy Controls',
          subtitle: 'Isolation, blocked domains & audit',
          onTap: () => widget.onNavigate('ai/privacy', context),
        ),
      ],
    );
  }

  // ── Advanced cards ──────────────────────────────────────────────────────

  Widget _buildAdvancedCards(bool isDark) {
    return Column(
      children: [
        _hubCard(
          isDark: isDark,
          icon: Icons.psychology_rounded,
          color: const Color(0xFFE040FB),
          title: 'Brain Admin',
          subtitle: 'Memory graph, quantum fading & GDPR consent',
          onTap: () => widget.onNavigate('ai/brain-admin', context),
        ),
        const SizedBox(height: 10),
        _hubCard(
          isDark: isDark,
          icon: Icons.groups_rounded,
          color: const Color(0xFF7C4DFF),
          title: 'Community Agents',
          subtitle: 'Personas, moderation & behavioral patterns',
          onTap: () => widget.onNavigate('ai/community-agents', context),
        ),
        const SizedBox(height: 10),
        _hubCard(
          isDark: isDark,
          icon: Icons.tune_rounded,
          color: const Color(0xFFFF7043),
          title: 'Calibration',
          subtitle: 'Confidence scoring & corrections pipeline',
          onTap: () => widget.onNavigate('ai/calibration', context),
        ),
        const SizedBox(height: 10),
        _hubCard(
          isDark: isDark,
          icon: Icons.lan_rounded,
          color: const Color(0xFF29B6F6),
          title: 'Federation',
          subtitle: 'Identity, peers & mesh health',
          onTap: () => widget.onNavigate('ai/federation', context),
        ),
      ],
    );
  }

  // ── Reusable card ───────────────────────────────────────────────────────

  Widget _hubCard({
    required bool isDark,
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    String? badge,
    Color? badgeColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: isDark
          ? Colors.white.withValues(alpha: 0.06)
          : Colors.black.withValues(alpha: 0.03),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                        ),
                        if (badge != null)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: (badgeColor ?? color)
                                  .withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              badge,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: badgeColor ?? color,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: isDark ? Colors.white54 : Colors.black45,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right_rounded,
                color: isDark ? Colors.white24 : Colors.black26,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
