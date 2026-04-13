import 'package:flutter/material.dart';

import 'brain_admin_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// BrainAdminPage — quantum fading, emotional intel, reasoning & GDPR consent
// ═══════════════════════════════════════════════════════════════════════════

class BrainAdminPage extends StatefulWidget {
  const BrainAdminPage({super.key, required this.service});

  final BrainAdminService service;

  @override
  State<BrainAdminPage> createState() => _BrainAdminPageState();
}

class _BrainAdminPageState extends State<BrainAdminPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  Map<String, dynamic> _graph = {};
  Map<String, dynamic> _quantumConfig = {};
  Map<String, dynamic> _emotionalSummary = {};
  List<dynamic> _emotionalHistory = [];
  List<dynamic> _reasoning = [];
  Map<String, dynamic> _consent = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      widget.service.getGraph(),
      widget.service.getQuantumFadeConfig(),
      widget.service.getEmotionalSummary(),
      widget.service.getEmotionalHistory(),
      widget.service.getReasoning(),
      widget.service.getMemoryConsent(),
    ]);
    if (!mounted) return;
    setState(() {
      _graph = results[0] as Map<String, dynamic>;
      _quantumConfig = results[1] as Map<String, dynamic>;
      _emotionalSummary = results[2] as Map<String, dynamic>;
      _emotionalHistory = results[3] as List<dynamic>;
      _reasoning = results[4] as List<dynamic>;
      _consent = results[5] as Map<String, dynamic>;
      _loading = false;
    });
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Brain Admin'),
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.scatter_plot), text: 'Quantum'),
            Tab(icon: Icon(Icons.favorite), text: 'Emotional'),
            Tab(icon: Icon(Icons.psychology), text: 'Reasoning'),
            Tab(icon: Icon(Icons.shield), text: 'GDPR'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _buildQuantumTab(cs),
                _buildEmotionalTab(cs),
                _buildReasoningTab(cs),
                _buildConsentTab(cs),
              ],
            ),
    );
  }

  // ── Quantum Fading ────────────────────────────────────────────────────

  Widget _buildQuantumTab(ColorScheme cs) {
    final keys = [
      'gamma_base',
      'amplitude',
      'omega',
      'consolidation_threshold',
      'resonance_factor',
    ];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _infoCard(
          'Decay Formula',
          'S(t) = γ_base · e^(-amplitude·t) · cos(ω·t + φ)',
          cs,
        ),
        const SizedBox(height: 12),
        ...keys.map((k) => _paramTile(k, _quantumConfig[k])),
        const SizedBox(height: 16),
        Text(
          'Graph Status',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        _statRow('Total Nodes', '${_graph['total_nodes'] ?? 0}'),
        _statRow('Total Edges', '${_graph['total_edges'] ?? 0}'),
      ],
    );
  }

  // ── Emotional Intelligence ────────────────────────────────────────────

  Widget _buildEmotionalTab(ColorScheme cs) {
    final emotions = ['joy', 'sadness', 'frustration', 'excitement',
        'confusion', 'neutral'];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _infoCard(
          'Emotional Summary',
          'Dominant: ${_emotionalSummary['dominant_mood'] ?? 'N/A'} · '
              'Avg sentiment: ${_emotionalSummary['avg_sentiment'] ?? 'N/A'}',
          cs,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: emotions.map((e) {
            final val = _emotionalSummary[e] ?? 0;
            return Chip(
              avatar: CircleAvatar(
                backgroundColor: _emotionColor(e),
                child: Text('$val', style: const TextStyle(fontSize: 10, color: Colors.white)),
              ),
              label: Text(e),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        Text('Recent History',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ..._emotionalHistory.take(20).map((h) {
          final entry = h as Map<String, dynamic>? ?? {};
          return ListTile(
            dense: true,
            leading: Icon(Icons.circle, size: 10,
                color: _emotionColor('${entry['emotion'] ?? ''}')),
            title: Text('${entry['emotion'] ?? 'unknown'}'),
            subtitle: Text('${entry['timestamp'] ?? ''}'),
            trailing: Text('${entry['intensity'] ?? ''}'),
          );
        }),
      ],
    );
  }

  Color _emotionColor(String emotion) {
    switch (emotion.toLowerCase()) {
      case 'joy': return Colors.amber;
      case 'sadness': return Colors.blue;
      case 'frustration': return Colors.red;
      case 'excitement': return Colors.orange;
      case 'confusion': return Colors.purple;
      default: return Colors.grey;
    }
  }

  // ── Reasoning ─────────────────────────────────────────────────────────

  Widget _buildReasoningTab(ColorScheme cs) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Reasoning Records',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (_reasoning.isEmpty)
          const Center(child: Text('No reasoning records yet.'))
        else
          ..._reasoning.take(30).map((r) {
            final entry = r as Map<String, dynamic>? ?? {};
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${entry['topic'] ?? 'Untitled'}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text('Choice: ${entry['choice'] ?? 'N/A'}',
                        style: TextStyle(color: cs.primary)),
                    if (entry['reasoning'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('${entry['reasoning']}',
                            style: TextStyle(
                                fontSize: 12, color: cs.onSurfaceVariant)),
                      ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  // ── GDPR Consent ──────────────────────────────────────────────────────

  Widget _buildConsentTab(ColorScheme cs) {
    final consentGiven = _consent['consent_given'] == true;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: consentGiven
                ? Colors.green.withValues(alpha: 0.1)
                : Colors.amber.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(consentGiven ? Icons.check_circle : Icons.warning,
                  color: consentGiven ? Colors.green : Colors.amber),
              const SizedBox(width: 12),
              Text(
                consentGiven ? 'Memory consent granted' : 'Consent pending',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _consentSwitch('Allow consolidation',
            _consent['allow_consolidation'] == true),
        _consentSwitch('Allow emotional tracking',
            _consent['allow_emotional_tracking'] == true),
        _consentSwitch('Allow reasoning capture',
            _consent['allow_reasoning_capture'] == true),
        const SizedBox(height: 8),
        _statRow('Retention days',
            '${_consent['retention_days'] ?? 'N/A'}'),
        const SizedBox(height: 24),
        const Divider(),
        const SizedBox(height: 8),
        Text('Danger Zone',
            style: TextStyle(
                fontWeight: FontWeight.bold, color: cs.error)),
        const SizedBox(height: 8),
        FilledButton.tonal(
          style: FilledButton.styleFrom(
            backgroundColor: cs.errorContainer,
            foregroundColor: cs.onErrorContainer,
          ),
          onPressed: () async {
            final confirmed = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Forget All Data?'),
                content: const Text(
                    'This will permanently erase all memory data. '
                    'This action cannot be undone.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Cancel'),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                        backgroundColor: cs.error),
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Erase Everything'),
                  ),
                ],
              ),
            );
            if (confirmed == true) {
              final ok = await widget.service.forgetAll();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(ok
                        ? 'All memory data erased.'
                        : 'Erase failed.'),
                  ),
                );
              }
            }
          },
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.delete_forever),
              SizedBox(width: 8),
              Text('Forget Me — Erase All Data'),
            ],
          ),
        ),
      ],
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  Widget _infoCard(String title, String body, ColorScheme cs) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(body, style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant)),
        ],
      ),
    );
  }

  Widget _paramTile(String key, dynamic value) {
    return ListTile(
      dense: true,
      title: Text(key.replaceAll('_', ' ')),
      trailing: Text('${value ?? 'N/A'}',
          style: const TextStyle(fontWeight: FontWeight.w600)),
    );
  }

  Widget _statRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13)),
          Text(value,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _consentSwitch(String label, bool value) {
    return SwitchListTile(
      title: Text(label, style: const TextStyle(fontSize: 14)),
      value: value,
      onChanged: null, // read-only display in mobile
    );
  }
}
