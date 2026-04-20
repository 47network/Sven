import 'package:flutter/material.dart';

import '../../app/sven_tokens.dart';
import '../../app/app_models.dart';
import 'org_switcher_service.dart';

class OrgSwitcherPage extends StatefulWidget {
  const OrgSwitcherPage({
    super.key,
    required this.service,
    required this.visualMode,
    required this.onSwitched,
  });

  final OrgSwitcherService service;
  final VisualMode visualMode;
  final VoidCallback onSwitched;

  @override
  State<OrgSwitcherPage> createState() => _OrgSwitcherPageState();
}

class _OrgSwitcherPageState extends State<OrgSwitcherPage> {
  List<Map<String, dynamic>> _orgs = [];
  String? _activeOrgId;
  bool _loading = true;
  bool _switching = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await widget.service.getOrganizations();
      final orgs =
          (data['organizations'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          [];
      setState(() {
        _orgs = orgs;
        _activeOrgId = data['active_organization_id'] as String?;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _switch(String orgId) async {
    if (orgId == _activeOrgId) return;
    setState(() => _switching = true);
    try {
      await widget.service.switchOrganization(orgId);
      setState(() {
        _activeOrgId = orgId;
        for (final o in _orgs) {
          o['is_active'] = o['id'] == orgId;
        }
      });
      widget.onSwitched();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Workspace switched')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to switch: $e')));
      }
    } finally {
      if (mounted) setState(() => _switching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Workspaces',
          style: TextStyle(
            color: tokens.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
        iconTheme: IconThemeData(color: tokens.onSurface),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _orgs.isEmpty
          ? Center(
              child: Text(
                'No organisations found',
                style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.6),
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _orgs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final org = _orgs[i];
                final isActive = org['id'] == _activeOrgId;
                final name = org['name'] as String? ?? 'Unnamed';
                final role = org['role'] as String? ?? 'member';
                final slug = org['slug'] as String? ?? '';

                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: isActive
                        ? tokens.primary.withValues(alpha: 0.12)
                        : (cinematic
                              ? Colors.white.withValues(alpha: 0.04)
                              : Colors.white),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isActive
                          ? tokens.primary
                          : tokens.frame.withValues(alpha: 0.3),
                      width: isActive ? 1.5 : 0.5,
                    ),
                  ),
                  child: ListTile(
                    onTap: _switching
                        ? null
                        : () => _switch(org['id'] as String),
                    leading: CircleAvatar(
                      backgroundColor: tokens.primary.withValues(alpha: 0.15),
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : '?',
                        style: TextStyle(
                          color: tokens.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    title: Text(
                      name,
                      style: TextStyle(
                        color: tokens.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      '$slug · $role',
                      style: TextStyle(
                        color: tokens.onSurface.withValues(alpha: 0.5),
                        fontSize: 12,
                      ),
                    ),
                    trailing: isActive
                        ? Icon(
                            Icons.check_circle_rounded,
                            color: tokens.primary,
                            size: 22,
                          )
                        : null,
                  ),
                );
              },
            ),
    );
  }
}
