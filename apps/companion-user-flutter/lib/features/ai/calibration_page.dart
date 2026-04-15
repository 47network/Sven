import 'package:flutter/material.dart';

import 'calibration_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// CalibrationPage — confidence scoring, feedback loops, corrections pipeline
// ═══════════════════════════════════════════════════════════════════════════

class CalibrationPage extends StatefulWidget {
  const CalibrationPage({super.key, required this.service});

  final CalibrationService service;

  @override
  State<CalibrationPage> createState() => _CalibrationPageState();
}

class _CalibrationPageState extends State<CalibrationPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  Map<String, dynamic> _calibration = {};
  List<dynamic> _lowConf = [];
  List<dynamic> _taskSummary = [];
  List<dynamic> _corrections = [];
  List<dynamic> _snapshots = [];
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
      widget.service.getCalibration(),
      widget.service.getLowConfidence(),
      widget.service.getTaskSummary(),
      widget.service.getCorrections(),
      widget.service.getSnapshots(),
    ]);
    if (!mounted) return;
    setState(() {
      _calibration = results[0] as Map<String, dynamic>;
      _lowConf = results[1] as List<dynamic>;
      _taskSummary = results[2] as List<dynamic>;
      _corrections = results[3] as List<dynamic>;
      _snapshots = results[4] as List<dynamic>;
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
        title: const Text('Calibrated Intelligence'),
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.speed), text: 'Confidence'),
            Tab(icon: Icon(Icons.feedback), text: 'Feedback'),
            Tab(icon: Icon(Icons.auto_fix_high), text: 'Corrections'),
            Tab(icon: Icon(Icons.insights), text: 'Snapshots'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _buildConfidenceTab(cs),
                _buildFeedbackTab(cs),
                _buildCorrectionsTab(cs),
                _buildSnapshotsTab(cs),
              ],
            ),
    );
  }

  // ── Confidence ────────────────────────────────────────────────────────

  Widget _buildConfidenceTab(ColorScheme cs) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _summaryGrid(cs, [
          _gridCell('Avg', '${_calibration['avg_confidence'] ?? 'N/A'}'),
          _gridCell('Score', '${_calibration['calibration_score'] ?? 'N/A'}'),
          _gridCell('Low', '${_lowConf.length}'),
        ]),
        const SizedBox(height: 16),
        Text('Low Confidence Responses',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (_lowConf.isEmpty)
          const Text('No low-confidence responses found.')
        else
          ..._lowConf.take(20).map((item) {
            final r = item as Map<String, dynamic>? ?? {};
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: CircleAvatar(
                  radius: 16,
                  backgroundColor: Colors.amber.shade100,
                  child: Text('${r['confidence'] ?? '?'}',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade800)),
                ),
                title: Text('${r['task_type'] ?? 'general'}'),
                subtitle: Text(
                  '${r['prompt'] ?? r['query'] ?? ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            );
          }),
      ],
    );
  }

  // ── Feedback ──────────────────────────────────────────────────────────

  Widget _buildFeedbackTab(ColorScheme cs) {
    if (_taskSummary.isEmpty) {
      return const Center(child: Text('No feedback signals recorded.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _taskSummary.length,
      itemBuilder: (ctx, i) {
        final f = _taskSummary[i] as Map<String, dynamic>? ?? {};
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            title: Text('${f['task_type'] ?? f['type'] ?? 'general'}'),
            subtitle: Row(
              children: [
                Text('👍 ${f['positive'] ?? 0}'),
                const SizedBox(width: 12),
                Text('👎 ${f['negative'] ?? 0}'),
                const SizedBox(width: 12),
                Text('Total: ${f['total'] ?? 0}',
                    style: TextStyle(color: cs.onSurfaceVariant)),
              ],
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
                        '${c['original_response'] ?? 'Original'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                    _statusBadge(status),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '→ ${c['correction'] ?? c['corrected_response'] ?? ''}',
                  style: TextStyle(fontSize: 13, color: cs.primary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _statusBadge(String status) {
    final color = status == 'verified'
        ? Colors.green
        : status == 'promoted'
            ? Colors.blue
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

  // ── Snapshots ─────────────────────────────────────────────────────────

  Widget _buildSnapshotsTab(ColorScheme cs) {
    if (_snapshots.isEmpty) {
      return const Center(child: Text('No improvement snapshots.'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _snapshots.length,
      itemBuilder: (ctx, i) {
        final s = _snapshots[i] as Map<String, dynamic>? ?? {};
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${s['date'] ?? s['snapshot_date'] ?? 'Snapshot ${i + 1}'}',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _miniStat('CorrRate', '${s['correction_rate'] ?? 'N/A'}'),
                    _miniStat('Confidence', '${s['avg_confidence'] ?? 'N/A'}'),
                    _miniStat('Corrections', '${s['corrections_count'] ?? 0}'),
                    _miniStat('Patterns', '${s['patterns_found'] ?? 0}'),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ── Shared helpers ────────────────────────────────────────────────────

  Widget _summaryGrid(ColorScheme cs, List<Widget> cells) {
    return Row(children: cells.map((c) => Expanded(child: c)).toList());
  }

  Widget _gridCell(String label, String value) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(fontSize: 11, color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _miniStat(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          Text(label,
              style: const TextStyle(fontSize: 10, color: Colors.grey)),
        ],
      ),
    );
  }
}
