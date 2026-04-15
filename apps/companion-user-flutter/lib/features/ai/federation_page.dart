import 'package:flutter/material.dart';

import 'federation_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// FederationPage — identity, peers, homeserver, topics, consent,
// sovereignty & mesh health
// ═══════════════════════════════════════════════════════════════════════════

class FederationPage extends StatefulWidget {
  const FederationPage({super.key, required this.service});

  final FederationService service;

  @override
  State<FederationPage> createState() => _FederationPageState();
}

class _FederationPageState extends State<FederationPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  Map<String, dynamic> _identity = {};
  List<dynamic> _peers = [];
  List<dynamic> _connections = [];
  Map<String, dynamic> _hsStats = {};
  List<dynamic> _topics = [];
  Map<String, dynamic> _consent = {};
  Map<String, dynamic> _consentStats = {};
  Map<String, dynamic> _sovereignty = {};
  Map<String, dynamic> _exportPolicy = {};
  Map<String, dynamic> _mesh = {};
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
      widget.service.getIdentity(),
      widget.service.getPeers(),
      widget.service.getConnections(),
      widget.service.getHomeserverStats(),
      widget.service.getTopics(),
      widget.service.getConsent(),
      widget.service.getConsentStats(),
      widget.service.getSovereignty(),
      widget.service.getExportPolicy(),
      widget.service.getMeshHealth(),
    ]);
    if (!mounted) return;
    setState(() {
      _identity = results[0] as Map<String, dynamic>;
      _peers = results[1] as List<dynamic>;
      _connections = results[2] as List<dynamic>;
      _hsStats = results[3] as Map<String, dynamic>;
      _topics = results[4] as List<dynamic>;
      _consent = results[5] as Map<String, dynamic>;
      _consentStats = results[6] as Map<String, dynamic>;
      _sovereignty = results[7] as Map<String, dynamic>;
      _exportPolicy = results[8] as Map<String, dynamic>;
      _mesh = results[9] as Map<String, dynamic>;
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
        title: const Text('Federation'),
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.key), text: 'Identity'),
            Tab(icon: Icon(Icons.people), text: 'Peers'),
            Tab(icon: Icon(Icons.dns), text: 'Homeserver'),
            Tab(icon: Icon(Icons.shield), text: 'Consent'),
            Tab(icon: Icon(Icons.monitor_heart), text: 'Health'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _buildIdentityTab(cs),
                _buildPeersTab(cs),
                _buildHomeserverTab(cs),
                _buildConsentTab(cs),
                _buildHealthTab(cs),
              ],
            ),
    );
  }

  // ── Identity ──────────────────────────────────────────────────────────

  Widget _buildIdentityTab(ColorScheme cs) {
    final hasId =
        _identity['public_key'] != null || _identity['key_id'] != null;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
              const Text('Federation Identity',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              if (hasId) ...[
                _statRow('Key ID', '${_identity['key_id'] ?? 'N/A'}'),
                _statRow('Algorithm', '${_identity['algorithm'] ?? 'ed25519'}'),
                const SizedBox(height: 4),
                Text(
                  '${_identity['public_key'] ?? ''}'.length > 48
                      ? '${'${_identity['public_key']}'.substring(0, 48)}…'
                      : '${_identity['public_key'] ?? ''}',
                  style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: cs.onSurfaceVariant),
                ),
              ] else
                const Text('No federation identity generated yet.'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (!hasId)
          FilledButton.icon(
            onPressed: () async {
              final result = await widget.service.generateIdentity();
              if (mounted && result.isNotEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Identity generated')));
                _load();
              }
            },
            icon: const Icon(Icons.add_circle_outline),
            label: const Text('Generate Identity'),
          ),
        if (hasId)
          OutlinedButton.icon(
            onPressed: () async {
              final ok = await widget.service.rotateIdentity();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok ? 'Key rotated' : 'Rotation failed')));
                _load();
              }
            },
            icon: const Icon(Icons.refresh),
            label: const Text('Rotate Key'),
          ),
        const SizedBox(height: 16),
        // ── Sovereignty & Export
        const Divider(),
        const SizedBox(height: 8),
        Text('Data Sovereignty',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        _statRow('Region', '${_sovereignty['data_residency'] ?? 'Not set'}'),
        _statRow(
            'Jurisdiction', '${_sovereignty['jurisdiction'] ?? 'Not set'}'),
        _statRow('Enforce Residency',
            _sovereignty['enforce_residency'] == true ? 'Yes' : 'No'),
        _statRow('Cross-border',
            _sovereignty['allow_cross_border'] == true ? 'Allowed' : 'Blocked'),
        const SizedBox(height: 12),
        Text('Export Policy', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        _statRow('Format', '${_exportPolicy['format'] ?? 'JSON'}'),
        _statRow('Encryption', '${_exportPolicy['encryption'] ?? 'AES-256'}'),
      ],
    );
  }

  // ── Peers ─────────────────────────────────────────────────────────────

  Widget _buildPeersTab(ColorScheme cs) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('${_peers.length} peer(s)',
                style: TextStyle(color: cs.onSurfaceVariant)),
            OutlinedButton.icon(
              onPressed: () async {
                final ok = await widget.service.prunePeers();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content:
                          Text(ok ? 'Stale peers pruned' : 'Prune failed')));
                  _load();
                }
              },
              icon: const Icon(Icons.cleaning_services, size: 16),
              label: const Text('Prune Stale'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_peers.isEmpty)
          const Center(child: Text('No federation peers.'))
        else
          ..._peers.map((p) {
            final peer = p as Map<String, dynamic>? ?? {};
            final trust = '${peer['trust_level'] ?? 'pending'}';
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: _trustColor(trust),
                  child:
                      const Icon(Icons.people, color: Colors.white, size: 18),
                ),
                title: Text('${peer['name'] ?? peer['peer_id'] ?? 'Peer'}'),
                subtitle: Text(
                    '${peer['endpoint'] ?? peer['url'] ?? ''}\nLast seen: ${peer['last_seen'] ?? 'never'}'),
                isThreeLine: true,
                trailing: trust == 'pending'
                    ? IconButton(
                        onPressed: () async {
                          final ok = await widget.service.handshakePeer(
                              '${peer['peer_id'] ?? peer['id']}');
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                content: Text(ok
                                    ? 'Handshake initiated'
                                    : 'Handshake failed')));
                            _load();
                          }
                        },
                        icon: const Icon(Icons.handshake),
                        tooltip: 'Initiate Handshake',
                      )
                    : _trustBadge(trust),
              ),
            );
          }),
        const SizedBox(height: 16),
        // ── Topics
        const Divider(),
        Text('Federated Topics (${_topics.length})',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (_topics.isEmpty)
          const Text('No federated topics.')
        else
          ..._topics.map((t) {
            final topic = t as Map<String, dynamic>? ?? {};
            return ListTile(
              dense: true,
              leading: const Icon(Icons.topic, size: 18),
              title: Text('${topic['title'] ?? topic['name'] ?? 'Topic'}'),
              subtitle: Text('${topic['description'] ?? ''}'),
              trailing: Text('${topic['peer_count'] ?? 0} peers',
                  style: const TextStyle(fontSize: 12)),
            );
          }),
      ],
    );
  }

  Color _trustColor(String trust) {
    switch (trust) {
      case 'verified':
        return Colors.green;
      case 'blocked':
        return Colors.red;
      default:
        return Colors.amber.shade700;
    }
  }

  Widget _trustBadge(String trust) {
    final color = _trustColor(trust);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(trust,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600, color: color)),
    );
  }

  // ── Homeserver ────────────────────────────────────────────────────────

  Widget _buildHomeserverTab(ColorScheme cs) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _summaryGrid(cs, [
          _gridCell('Connections', '${_connections.length}'),
          _gridCell('Messages', '${_hsStats['messages_relayed'] ?? 0}'),
          _gridCell('Uptime', '${_hsStats['uptime'] ?? 'N/A'}'),
        ]),
        const SizedBox(height: 16),
        Text('Connected Homeservers',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (_connections.isEmpty)
          const Text('No active connections.')
        else
          ..._connections.map((c) {
            final conn = c as Map<String, dynamic>? ?? {};
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: Icon(Icons.dns,
                    color: conn['status'] == 'connected'
                        ? Colors.green
                        : Colors.grey),
                title:
                    Text('${conn['server_name'] ?? conn['host'] ?? 'Server'}'),
                subtitle: Text('${conn['endpoint'] ?? conn['url'] ?? ''}'),
                trailing: Text('${conn['status'] ?? 'unknown'}',
                    style: TextStyle(
                        fontSize: 12,
                        color: conn['status'] == 'connected'
                            ? Colors.green
                            : cs.onSurfaceVariant)),
              ),
            );
          }),
      ],
    );
  }

  // ── Consent ───────────────────────────────────────────────────────────

  Widget _buildConsentTab(ColorScheme cs) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _summaryGrid(cs, [
          _gridCell('Consented', '${_consentStats['consented'] ?? 0}'),
          _gridCell('Revoked', '${_consentStats['revoked'] ?? 0}'),
          _gridCell('Rate', '${_consentStats['consent_rate'] ?? 'N/A'}%'),
        ]),
        const SizedBox(height: 16),
        Text('Consent Settings',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        _consentSwitch(
            'Allow Federation', _consent['allow_federation'] == true),
        _consentSwitch(
            'Allow Data Sharing', _consent['allow_data_sharing'] == true),
        _consentSwitch('Allow Identity Disclosure',
            _consent['allow_identity_disclosure'] == true),
        _consentSwitch(
            'Allow Message Relay', _consent['allow_message_relay'] == true),
      ],
    );
  }

  // ── Health ────────────────────────────────────────────────────────────

  Widget _buildHealthTab(ColorScheme cs) {
    final meshPeers = _mesh['peers'] ?? _mesh['nodes'] ?? [];
    final peerList = meshPeers is List ? meshPeers : <dynamic>[];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _summaryGrid(cs, [
          _gridCell('Status', '${_mesh['status'] ?? 'unknown'}'),
          _gridCell('Healthy', '${_mesh['healthy'] ?? 0}'),
          _gridCell('Degraded', '${_mesh['degraded'] ?? 0}'),
        ]),
        const SizedBox(height: 12),
        Center(
          child: FilledButton.icon(
            onPressed: () async {
              final ok = await widget.service.runHealthCheck();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content:
                        Text(ok ? 'Health check completed' : 'Check failed')));
                _load();
              }
            },
            icon: const Icon(Icons.refresh),
            label: const Text('Run Health Check'),
          ),
        ),
        const SizedBox(height: 16),
        Text('Peer Health', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (peerList.isEmpty)
          const Text('Run a health check to see mesh status.')
        else
          ...peerList.take(20).map((p) {
            final peer = p as Map<String, dynamic>? ?? {};
            final status = '${peer['status'] ?? 'unknown'}';
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: Icon(
                  status == 'healthy'
                      ? Icons.check_circle
                      : status == 'degraded'
                          ? Icons.warning
                          : Icons.error,
                  color: status == 'healthy'
                      ? Colors.green
                      : status == 'degraded'
                          ? Colors.amber
                          : Colors.red,
                ),
                title: Text('${peer['name'] ?? peer['peer_id'] ?? 'Peer'}'),
                subtitle: Text(
                    'Latency: ${peer['latency_ms'] ?? '?'}ms · Last: ${peer['last_check'] ?? 'never'}'),
              ),
            );
          }),
      ],
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
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _statRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13)),
          Text(value,
              style:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _consentSwitch(String label, bool value) {
    return SwitchListTile(
      title: Text(label, style: const TextStyle(fontSize: 14)),
      value: value,
      onChanged: null, // read-only on mobile
    );
  }
}
