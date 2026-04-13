import 'package:flutter/material.dart';

import 'community_agents_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// CommunityAgentsPage — agent personas, moderation, changelog,
// confidence, corrections, patterns & self-improvement
// ═══════════════════════════════════════════════════════════════════════════

class CommunityAgentsPage extends StatefulWidget {
  const CommunityAgentsPage({super.key, required this.service});

  final CommunityAgentsService service;

  @override
  State<CommunityAgentsPage> createState() => _CommunityAgentsPageState();
}

class _CommunityAgentsPageState extends State<CommunityAgentsPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  List<dynamic> _personas = [];
  List<dynamic> _moderation = [];
  List<dynamic> _changelog = [];
  Map<String, dynamic> _calibration = {};
  List<dynamic> _lowConf = [];
  List<dynamic> _corrections = [];
  List<dynamic> _patterns = [];
  List<dynamic> _snapshots = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 5, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      widget.service.getPersonas(),
      widget.service.getModerationPending(),
      widget.service.getChangelog(),
      widget.service.getCalibration(),
      widget.service.getLowConfidence(),
      widget.service.getCorrections(),
      widget.service.getPatterns(),
      widget.service.getSelfImprovementSnapshots(),
    ]);
    if (!mounted) return;
    setState(() {
      _personas = results[0] as List<dynamic>;
      _moderation = results[1] as List<dynamic>;
      _changelog = results[2] as List<dynamic>;
      _calibration = results[3] as Map<String, dynamic>;
      _lowConf = results[4] as List<dynamic>;
      _corrections = results[5] as List<dynamic>;
      _patterns = results[6] as List<dynamic>;
      _snapshots = results[7] as List<dynamic>;
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
        title: const Text('Community Agents'),
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.smart_toy), text: 'Personas'),
            Tab(icon: Icon(Icons.gavel), text: 'Moderation'),
            Tab(icon: Icon(Icons.article), text: 'Changelog'),
            Tab(icon: Icon(Icons.auto_fix_high), text: 'Corrections'),
            Tab(icon: Icon(Icons.trending_up), text: 'Improvement'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _buildPersonasTab(cs),
                _buildModerationTab(cs),
                _buildChangelogTab(cs),
                _buildCorrectionsTab(cs),
                _buildImprovementTab(cs),
              ],
            ),
    );
  }

  // ── Personas ──────────────────────────────────────────────────────────

  Widget _buildPersonasTab(ColorScheme cs) {
    if (_personas.isEmpty) {
      return const Center(child: Text('No agent personas configured.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _personas.length,
      itemBuilder: (ctx, i) {
        final p = _personas[i] as Map<String, dynamic>? ?? {};
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: _typeColor(p['type'] as String? ?? ''),
              child: const Icon(Icons.smart_toy, color: Colors.white, size: 20),
            ),
            title: Text('${p['name'] ?? p['agent_id'] ?? 'Agent'}'),
            subtitle: Text('${p['type'] ?? ''} · ${p['status'] ?? 'unknown'}'),
            trailing: p['community_visible'] == true
                ? Icon(Icons.visibility, size: 16, color: cs.primary)
                : null,
          ),
        );
      },
    );
  }

  Color _typeColor(String type) {
    switch (type.toLowerCase()) {
      case 'guide': return Colors.teal;
      case 'inspector': return Colors.amber.shade700;
      case 'curator': return Colors.green;
      case 'advocate': return Colors.deepPurple;
      case 'qa': return Colors.red;
      default: return Colors.blueGrey;
    }
  }

  // ── Moderation ────────────────────────────────────────────────────────

  Widget _buildModerationTab(ColorScheme cs) {
    if (_moderation.isEmpty) {
      return const Center(child: Text('No pending moderation reviews.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _moderation.length,
      itemBuilder: (ctx, i) {
        final m = _moderation[i] as Map<String, dynamic>? ?? {};
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('${m['agent_name'] ?? m['agent_id'] ?? 'Agent'}',
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                    ),
                    _riskBadge(m['risk_level'] as String? ?? 'pending'),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '${m['content'] ?? m['message'] ?? ''}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    FilledButton.tonal(
                      onPressed: () => _review(m, 'approved'),
                      child: const Text('Approve'),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: () => _review(m, 'rejected'),
                      child: const Text('Reject'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _review(Map<String, dynamic> m, String decision) async {
    final id = '${m['decision_id'] ?? m['id']}';
    final ok = await widget.service.reviewModeration(
      id,
      {'decision': decision, 'explanation': '$decision by mobile admin'},
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ok ? 'Review submitted' : 'Review failed')),
      );
      _load();
    }
  }

  Widget _riskBadge(String risk) {
    final color = risk == 'high'
        ? Colors.red
        : risk == 'medium'
            ? Colors.amber.shade700
            : Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(risk,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }

  // ── Changelog ─────────────────────────────────────────────────────────

  Widget _buildChangelogTab(ColorScheme cs) {
    if (_changelog.isEmpty) {
      return const Center(child: Text('No transparency changelog entries.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _changelog.length,
      itemBuilder: (ctx, i) {
        final e = _changelog[i] as Map<String, dynamic>? ?? {};
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            title: Text('${e['title'] ?? e['type'] ?? 'Entry'}'),
            subtitle: Text(
              '${e['content'] ?? e['body'] ?? ''}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: e['published'] == true
                ? Icon(Icons.check_circle, color: cs.primary, size: 18)
                : TextButton(
                    onPressed: () async {
                      final ok = await widget.service
                          .publishChangelog('${e['entry_id'] ?? e['id']}');
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                              content: Text(
                                  ok ? 'Published' : 'Publish failed')),
                        );
                        _load();
                      }
                    },
                    child: const Text('Publish'),
                  ),
          ),
        );
      },
    );
  }

  // ── Corrections ───────────────────────────────────────────────────────

  Widget _buildCorrectionsTab(ColorScheme cs) {
    if (_corrections.isEmpty) {
      return const Center(child: Text('No corrections submitted.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _corrections.length,
      itemBuilder: (ctx, i) {
        final c = _corrections[i] as Map<String, dynamic>? ?? {};
        final status = '${c['status'] ?? 'pending'}';
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${c['original_response'] ?? ''}'.length > 80
                            ? '${'${c['original_response']}'.substring(0, 80)}…'
                            : '${c['original_response'] ?? 'Original'}',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                    _statusBadge(status, cs),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '→ ${c['correction'] ?? c['corrected_response'] ?? ''}',
                  style: TextStyle(color: cs.primary, fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (status == 'pending') ...[
                  const SizedBox(height: 8),
                  FilledButton.tonal(
                    onPressed: () async {
                      final ok = await widget.service
                          .verifyCorrection('${c['correction_id'] ?? c['id']}');
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text(
                                ok ? 'Verified' : 'Verification failed')));
                        _load();
                      }
                    },
                    child: const Text('Verify'),
                  ),
                ],
                if (status == 'verified') ...[
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () async {
                      final ok = await widget.service
                          .promoteCorrection('${c['correction_id'] ?? c['id']}');
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text(
                                ok ? 'Promoted' : 'Promotion failed')));
                        _load();
                      }
                    },
                    child: const Text('Promote to Memory'),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _statusBadge(String status, ColorScheme cs) {
    final color = status == 'verified'
        ? Colors.green
        : status == 'promoted'
            ? cs.primary
            : Colors.amber.shade700;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(status,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }

  // ── Self-Improvement ──────────────────────────────────────────────────

  Widget _buildImprovementTab(ColorScheme cs) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── Calibration summary
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cs.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Confidence Calibration',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              _statRow('Avg Confidence',
                  '${_calibration['avg_confidence'] ?? 'N/A'}'),
              _statRow('Calibration Score',
                  '${_calibration['calibration_score'] ?? 'N/A'}'),
              _statRow('Low Confidence Items', '${_lowConf.length}'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // ── Patterns
        Text('Behavioral Patterns (${_patterns.length})',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (_patterns.isEmpty)
          const Text('No patterns observed yet.')
        else
          ..._patterns.take(10).map((p) {
            final pat = p as Map<String, dynamic>? ?? {};
            return ListTile(
              dense: true,
              leading: const Icon(Icons.pattern, size: 18),
              title: Text('${pat['description'] ?? pat['name'] ?? 'Pattern'}'),
              subtitle: Text('${pat['type'] ?? ''} · x${pat['occurrences'] ?? pat['count'] ?? 0}'),
              trailing: _statusBadge('${pat['status'] ?? 'observed'}', cs),
            );
          }),
        const SizedBox(height: 16),
        // ── Snapshots
        Text('Improvement Snapshots (${_snapshots.length})',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (_snapshots.isEmpty)
          const Text('No improvement data collected yet.')
        else
          ..._snapshots.take(10).map((s) {
            final snap = s as Map<String, dynamic>? ?? {};
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${snap['date'] ?? snap['snapshot_date'] ?? 'Snapshot'}',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _miniStat('Correction Rate', '${snap['correction_rate'] ?? 'N/A'}'),
                        _miniStat('Confidence', '${snap['avg_confidence'] ?? 'N/A'}'),
                        _miniStat('Patterns', '${snap['patterns_found'] ?? 0}'),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  // ── Shared helpers ────────────────────────────────────────────────────

  Widget _statRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
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

  Widget _miniStat(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          Text(label,
              style: const TextStyle(fontSize: 10, color: Colors.grey)),
        ],
      ),
    );
  }
}
