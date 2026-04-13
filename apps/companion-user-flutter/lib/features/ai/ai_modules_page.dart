import 'package:flutter/material.dart';


import '../../app/authenticated_client.dart';
import 'ai_policy_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// AiModulesPage — browse, install & manage AI capability modules
//
// Catalog of available modules with device-specific recommendations,
// install/uninstall controls, and installed module stats.
// ═══════════════════════════════════════════════════════════════════════════

class AiModulesPage extends StatefulWidget {
  const AiModulesPage({super.key, required this.client});

  final AuthenticatedClient client;

  @override
  State<AiModulesPage> createState() => _AiModulesPageState();
}

class _AiModulesPageState extends State<AiModulesPage>
    with SingleTickerProviderStateMixin {
  late final AiPolicyService _service;
  late final TabController _tabCtrl;

  List<Map<String, dynamic>> _catalog = [];
  List<Map<String, dynamic>> _recommended = [];
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _service = AiPolicyService(client: widget.client);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _service.listModules(),
        _service.getRecommendedModules(),
        _service.getModuleStats(),
      ]);
      if (!mounted) return;
      setState(() {
        _catalog = results[0] as List<Map<String, dynamic>>;
        _recommended = results[1] as List<Map<String, dynamic>>;
        _stats = results[2] as Map<String, dynamic>;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Modules'),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: const [
            Tab(text: 'Catalog'),
            Tab(text: 'Recommended'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildStatsBar(isDark),
                Expanded(
                  child: TabBarView(
                    controller: _tabCtrl,
                    children: [
                      _buildModuleList(_catalog, isDark),
                      _buildModuleList(_recommended, isDark),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildStatsBar(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: isDark
          ? Colors.white.withValues(alpha: 0.04)
          : Colors.black.withValues(alpha: 0.02),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _miniStat('Installed', '${_stats['installed_count'] ?? 0}', isDark),
          _miniStat('Available', '${_catalog.length}', isDark),
          _miniStat(
              'Storage', '${_stats['total_size_mb'] ?? 0} MB', isDark),
        ],
      ),
    );
  }

  Widget _miniStat(String label, String value, bool isDark) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? Colors.white54 : Colors.black45,
          ),
        ),
      ],
    );
  }

  Widget _buildModuleList(List<Map<String, dynamic>> modules, bool isDark) {
    if (modules.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.extension_off_rounded,
                size: 48, color: isDark ? Colors.white24 : Colors.black26),
            const SizedBox(height: 8),
            Text(
              'No modules available',
              style: TextStyle(
                color: isDark ? Colors.white38 : Colors.black38,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: modules.length,
        itemBuilder: (ctx, i) => _moduleTile(modules[i], isDark),
      ),
    );
  }

  Widget _moduleTile(Map<String, dynamic> mod, bool isDark) {
    final name = mod['name'] ?? 'Unknown';
    final desc = mod['description'] ?? '';
    final installed = mod['installed'] == true;
    final sizeMb = mod['size_mb'] ?? 0;
    final category = mod['category'] ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.black.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(14),
          border: installed
              ? Border.all(
                  color:
                      const Color(0xFFAB47BC).withValues(alpha: 0.4))
              : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFAB47BC).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _iconFor(category.toString()),
                color: const Color(0xFFAB47BC),
                size: 22,
              ),
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
                          name.toString(),
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                      ),
                      if (installed)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'INSTALLED',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.green,
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (desc.toString().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      desc.toString(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.white54 : Colors.black45,
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Text(
                        '${sizeMb}MB',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white38 : Colors.black38,
                        ),
                      ),
                      if (category.toString().isNotEmpty) ...[
                        const SizedBox(width: 12),
                        Text(
                          category.toString(),
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? Colors.white38 : Colors.black38,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconFor(String category) {
    return switch (category) {
      'vision' => Icons.visibility_rounded,
      'language' => Icons.translate_rounded,
      'audio' => Icons.headphones_rounded,
      'code' => Icons.code_rounded,
      'math' => Icons.calculate_rounded,
      _ => Icons.extension_rounded,
    };
  }
}
