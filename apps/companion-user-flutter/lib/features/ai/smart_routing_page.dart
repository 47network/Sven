import 'package:flutter/material.dart';

import '../../app/authenticated_client.dart';
import 'ai_policy_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// SmartRoutingPage — view & configure local-vs-cloud inference routing
// ═══════════════════════════════════════════════════════════════════════════

class SmartRoutingPage extends StatefulWidget {
  const SmartRoutingPage({super.key, required this.client});

  final AuthenticatedClient client;

  @override
  State<SmartRoutingPage> createState() => _SmartRoutingPageState();
}

class _SmartRoutingPageState extends State<SmartRoutingPage> {
  late final AiPolicyService _service;

  Map<String, dynamic> _policy = {};
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _service = AiPolicyService(client: widget.client);
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _service.getRoutingPolicy(),
        _service.getRoutingStats(),
      ]);
      if (!mounted) return;
      setState(() {
        _policy = results[0];
        _stats = results[1];
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleLocalOnly(bool value) async {
    final ok = await _service.updateRoutingPolicy({'prefer_local': value});
    if (ok && mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('Smart Routing')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildRoutingDiagram(isDark),
                  const SizedBox(height: 16),
                  _buildPolicyCard(isDark),
                  const SizedBox(height: 16),
                  _buildStatsCard(isDark),
                ],
              ),
            ),
    );
  }

  Widget _buildRoutingDiagram(bool isDark) {
    final localPct = (_stats['local_percentage'] ?? 0) as num;
    final cloudPct = 100 - localPct.toInt();

    return _card(
      isDark: isDark,
      child: Column(
        children: [
          Text(
            'Routing Split',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 16,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 24,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Row(
                children: [
                  Flexible(
                    flex: localPct.toInt().clamp(1, 100),
                    child: Container(
                      color: const Color(0xFF4CAF50),
                      alignment: Alignment.center,
                      child: localPct >= 15
                          ? Text(
                              '${localPct.toInt()}%',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            )
                          : null,
                    ),
                  ),
                  Flexible(
                    flex: cloudPct.clamp(1, 100),
                    child: Container(
                      color: const Color(0xFF42A5F5),
                      alignment: Alignment.center,
                      child: cloudPct >= 15
                          ? Text(
                              '$cloudPct%',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            )
                          : null,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _legendDot('Local', const Color(0xFF4CAF50), isDark),
              _legendDot('Cloud', const Color(0xFF42A5F5), isDark),
            ],
          ),
        ],
      ),
    );
  }

  Widget _legendDot(String label, Color color, bool isDark) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: isDark ? Colors.white70 : Colors.black54,
          ),
        ),
      ],
    );
  }

  Widget _buildPolicyCard(bool isDark) {
    final preferLocal = _policy['prefer_local'] == true;
    final threshold = _policy['complexity_threshold'] ?? 'medium';

    return _card(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Routing Policy',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'Prefer Local Processing',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            subtitle: Text(
              preferLocal
                  ? 'Send to cloud only when model is unavailable'
                  : 'Complex queries automatically routed to cloud',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white54 : Colors.black45,
              ),
            ),
            value: preferLocal,
            onChanged: _toggleLocalOnly,
          ),
          const Divider(),
          _statRow('Complexity threshold', '$threshold', isDark),
          _statRow(
            'Fallback',
            _policy['cloud_fallback'] == false ? 'Disabled' : 'Enabled',
            isDark,
          ),
          _statRow(
            'Offline mode',
            _policy['offline_capable'] == true ? 'Yes' : 'No',
            isDark,
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
            'Routing Stats',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          _statRow(
            'Total requests',
            '${_stats['total_requests'] ?? 0}',
            isDark,
          ),
          _statRow('Routed locally', '${_stats['local_count'] ?? 0}', isDark),
          _statRow('Routed to cloud', '${_stats['cloud_count'] ?? 0}', isDark),
          _statRow(
            'Avg latency (local)',
            '${_stats['avg_local_ms'] ?? 0}ms',
            isDark,
          ),
          _statRow(
            'Avg latency (cloud)',
            '${_stats['avg_cloud_ms'] ?? 0}ms',
            isDark,
          ),
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
