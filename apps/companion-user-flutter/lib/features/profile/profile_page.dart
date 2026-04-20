import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'profile_service.dart';

/// User profile page (Batch 7.1).
/// Shows avatar, display name, bio, timezone, status, and member-since.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, required this.profileService});

  final ProfileService profileService;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic> _profile = {};
  bool _loading = true;
  bool _saving = false;

  late final TextEditingController _displayNameCtrl;
  late final TextEditingController _bioCtrl;
  late final TextEditingController _timezoneCtrl;
  late final TextEditingController _statusEmojiCtrl;
  late final TextEditingController _statusTextCtrl;

  @override
  void initState() {
    super.initState();
    _displayNameCtrl = TextEditingController();
    _bioCtrl = TextEditingController();
    _timezoneCtrl = TextEditingController();
    _statusEmojiCtrl = TextEditingController();
    _statusTextCtrl = TextEditingController();
    _load();
  }

  @override
  void dispose() {
    _displayNameCtrl.dispose();
    _bioCtrl.dispose();
    _timezoneCtrl.dispose();
    _statusEmojiCtrl.dispose();
    _statusTextCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final p = await widget.profileService.getProfile();
      if (!mounted) return;
      setState(() {
        _profile = p;
        _displayNameCtrl.text = _s(p['display_name']);
        _bioCtrl.text = _s(p['bio']);
        _timezoneCtrl.text = _s(p['timezone']);
        _statusEmojiCtrl.text = _s(p['status_emoji']);
        _statusTextCtrl.text = _s(p['status_text']);
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    HapticFeedback.mediumImpact();
    setState(() => _saving = true);
    try {
      final updated = await widget.profileService.updateProfile({
        'display_name': _displayNameCtrl.text.trim(),
        'bio': _bioCtrl.text.trim(),
        'timezone': _timezoneCtrl.text.trim(),
        'status_emoji': _statusEmojiCtrl.text.trim(),
        'status_text': _statusTextCtrl.text.trim(),
      });
      if (!mounted) return;
      setState(() {
        _profile = updated;
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile updated'),
          duration: Duration(seconds: 2),
        ),
      );
    } catch (_) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update profile')),
        );
      }
    }
  }

  String _s(dynamic v) => (v ?? '').toString();

  String get _initials {
    final name = _s(_profile['display_name']);
    if (name.isEmpty) return '?';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  String get _memberSince {
    final raw = _s(_profile['created_at']);
    if (raw.isEmpty) return '';
    try {
      final dt = DateTime.parse(raw);
      return '${_monthName(dt.month)} ${dt.year}';
    } catch (_) {
      return raw;
    }
  }

  static String _monthName(int m) => const [
    '',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][m];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          if (!_loading)
            TextButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Save'),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              children: [
                // Avatar + name header
                Center(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 48,
                        backgroundColor: cs.primaryContainer,
                        backgroundImage: _s(_profile['avatar_url']).isNotEmpty
                            ? NetworkImage(_s(_profile['avatar_url']))
                            : null,
                        child: _s(_profile['avatar_url']).isEmpty
                            ? Text(
                                _initials,
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  color: cs.onPrimaryContainer,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '@${_s(_profile['username'])}',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                      if (_memberSince.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Member since $_memberSince',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: cs.outline,
                          ),
                        ),
                      ],
                      if (_s(_profile['role']).isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: cs.tertiaryContainer,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _s(_profile['role']).toUpperCase(),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: cs.onTertiaryContainer,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                // Status section
                Text(
                  'Status',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    SizedBox(
                      width: 56,
                      child: TextField(
                        controller: _statusEmojiCtrl,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 24),
                        decoration: const InputDecoration(
                          hintText: '😊',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(vertical: 10),
                        ),
                        inputFormatters: [LengthLimitingTextInputFormatter(2)],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _statusTextCtrl,
                        decoration: const InputDecoration(
                          hintText: 'What are you up to?',
                          border: OutlineInputBorder(),
                        ),
                        maxLength: 128,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Display name
                Text(
                  'Display Name',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _displayNameCtrl,
                  decoration: const InputDecoration(
                    hintText: 'How others see you',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  maxLength: 256,
                ),
                const SizedBox(height: 20),

                // Bio
                Text(
                  'Bio',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _bioCtrl,
                  decoration: const InputDecoration(
                    hintText: 'A few words about yourself',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                  maxLength: 500,
                ),
                const SizedBox(height: 20),

                // Timezone
                Text(
                  'Timezone',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _timezoneCtrl,
                  decoration: const InputDecoration(
                    hintText: 'e.g. Europe/Berlin',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.schedule),
                  ),
                ),
                const SizedBox(height: 20),

                // Organization
                if (_s(_profile['active_organization_name']).isNotEmpty) ...[
                  Text(
                    'Organization',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Card(
                    child: ListTile(
                      leading: Icon(Icons.business, color: cs.primary),
                      title: Text(_s(_profile['active_organization_name'])),
                      subtitle: Text('Role: ${_s(_profile['role'])}'),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}
