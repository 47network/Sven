import 'package:flutter/material.dart';

import '../../app/authenticated_client.dart';
import 'ai_policy_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// PrivacyControlsPage — on-device AI privacy isolation dashboard
//
// View/edit privacy policy, blocked domains, isolation verification.
// ═══════════════════════════════════════════════════════════════════════════

class PrivacyControlsPage extends StatefulWidget {
  const PrivacyControlsPage({super.key, required this.client});

  final AuthenticatedClient client;

  @override
  State<PrivacyControlsPage> createState() => _PrivacyControlsPageState();
}

class _PrivacyControlsPageState extends State<PrivacyControlsPage> {
  late final AiPolicyService _service;

  Map<String, dynamic> _policy = {};
  Map<String, dynamic> _isolation = {};
  Map<String, dynamic> _auditStats = {};
  List<String> _blockedDomains = [];
  bool _loading = true;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _service = AiPolicyService(client: widget.client);
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _service.getPrivacyPolicy(),
        _service.verifyIsolation(),
        _service.getAuditStats(),
        _service.getBlockedDomains(),
      ]);
      if (!mounted) return;
      setState(() {
        _policy = results[0] as Map<String, dynamic>;
        _isolation = results[1] as Map<String, dynamic>;
        _auditStats = results[2] as Map<String, dynamic>;
        _blockedDomains = results[3] as List<String>;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleLocalDefault(bool value) async {
    final ok = await _service.updatePrivacyPolicy({
      'local_inference_default': value,
    });
    if (ok && mounted) _load();
  }

  Future<void> _toggleTelemetry(bool value) async {
    final ok = await _service.updatePrivacyPolicy({
      'telemetry_enabled': value,
    });
    if (ok && mounted) _load();
  }

  Future<void> _runIsolationCheck() async {
    setState(() => _verifying = true);
    final result = await _service.verifyIsolation();
    if (mounted) {
      setState(() {
        _isolation = result;
        _verifying = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Privacy Controls'),
        actions: [
          IconButton(
            tooltip: 'Run isolation check',
            icon: _verifying
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.verified_user_rounded),
            onPressed: _verifying ? null : _runIsolationCheck,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildIsolationStatus(isDark),
                  const SizedBox(height: 16),
                  _buildPolicyToggles(isDark),
                  const SizedBox(height: 16),
                  _buildAuditStats(isDark),
                  const SizedBox(height: 16),
                  _buildBlockedDomains(isDark),
                ],
              ),
            ),
    );
  }

  Widget _buildIsolationStatus(bool isDark) {
    final verified = _isolation['isolated'] == true;
    final color = verified ? Colors.green : Colors.orange;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Icon(
            verified
                ? Icons.check_circle_rounded
                : Icons.warning_amber_rounded,
            color: color,
            size: 48,
          ),
          const SizedBox(height: 10),
          Text(
            verified ? 'Fully Isolated' : 'Partial Isolation',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            verified
                ? 'No AI data leaves your device. All processing is local.'
                : 'Some data may be sent to cloud for complex queries.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: isDark ? Colors.white60 : Colors.black54,
            ),
          ),
          if (_isolation['last_verified'] != null) ...[
            const SizedBox(height: 8),
            Text(
              'Last verified: ${_isolation['last_verified']}',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? Colors.white38 : Colors.black38,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPolicyToggles(bool isDark) {
    final localDefault = _policy['local_inference_default'] == true;
    final telemetry = _policy['telemetry_enabled'] == true;

    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Privacy Policy',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'Local-Only Inference',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            subtitle: Text(
              'Process all AI queries on-device',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
            value: localDefault,
            onChanged: _toggleLocalDefault,
          ),
          const Divider(),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'AI Telemetry',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            subtitle: Text(
              telemetry
                  ? 'Anonymous usage data collected to improve models'
                  : 'No usage data leaves your device',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
            value: telemetry,
            onChanged: _toggleTelemetry,
          ),
        ],
      ),
    );
  }

  Widget _buildAuditStats(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Privacy Audit',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          _statRow('Total requests audited',
              '${_auditStats['total_audited'] ?? 0}', isDark),
          _statRow('Blocked outbound',
              '${_auditStats['blocked_outbound'] ?? 0}', isDark),
          _statRow('Local-processed',
              '${_auditStats['local_processed'] ?? 0}', isDark),
          _statRow('Policy violations',
              '${_auditStats['violations'] ?? 0}', isDark),
        ],
      ),
    );
  }

  Widget _buildBlockedDomains(bool isDark) {
    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Blocked Domains',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              Text(
                '${_blockedDomains.length}',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white54 : Colors.black45,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_blockedDomains.isEmpty)
            Text(
              'No domains blocked',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.white38 : Colors.black38,
              ),
            )
          else
            ...(_blockedDomains.take(30).map(
                  (d) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Icon(Icons.block_rounded,
                            size: 14,
                            color: Colors.red.withValues(alpha: 0.6)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            d,
                            style: TextStyle(
                              fontSize: 13,
                              fontFamily: 'monospace',
                              color: isDark ? Colors.white70 : Colors.black54,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                )),
        ],
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
          Text(label,
              style: TextStyle(
                  fontSize: 13,
                  color: isDark ? Colors.white60 : Colors.black54)),
          Text(value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87)),
        ],
      ),
    );
  }
}
