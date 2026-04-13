part of 'settings_sheet.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Change-password page
// ═══════════════════════════════════════════════════════════════════════════

class _ChangePasswordPage extends StatefulWidget {
  const _ChangePasswordPage({
    required this.authService,
    required this.visualMode,
  });

  final AuthService authService;
  final VisualMode visualMode;

  @override
  State<_ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<_ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final err = await widget.authService.changePassword(
      currentPassword: _currentCtrl.text,
      newPassword: _newCtrl.text,
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (err != null) {
      setState(() => _error = err);
    } else {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password changed successfully'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;

    return Scaffold(
      backgroundColor: cinematic ? tokens.scaffold : tokens.scaffold,
      appBar: _svenAppBar(
        context,
        'Change Password',
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: tokens.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
        backgroundColor: cinematic ? tokens.card : tokens.surface,
        foregroundColor: tokens.onSurface,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 20),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .error
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: Theme.of(context)
                              .colorScheme
                              .error
                              .withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline,
                            size: 18,
                            color: Theme.of(context).colorScheme.error),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                _PwField(
                  label: 'Current password',
                  controller: _currentCtrl,
                  obscure: _obscureCurrent,
                  onToggle: () =>
                      setState(() => _obscureCurrent = !_obscureCurrent),
                  tokens: tokens,
                  cinematic: cinematic,
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                _PwField(
                  label: 'New password',
                  controller: _newCtrl,
                  obscure: _obscureNew,
                  onToggle: () => setState(() => _obscureNew = !_obscureNew),
                  tokens: tokens,
                  cinematic: cinematic,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (v.length < 8) return 'Minimum 8 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                _PwField(
                  label: 'Confirm new password',
                  controller: _confirmCtrl,
                  obscure: _obscureConfirm,
                  onToggle: () =>
                      setState(() => _obscureConfirm = !_obscureConfirm),
                  tokens: tokens,
                  cinematic: cinematic,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (v != _newCtrl.text) return 'Passwords do not match';
                    return null;
                  },
                ),
                const SizedBox(height: 32),
                FilledButton(
                  onPressed: _saving ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: tokens.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Update password',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Small helper: password text field with show/hide toggle
class _PwField extends StatelessWidget {
  const _PwField({
    required this.label,
    required this.controller,
    required this.obscure,
    required this.onToggle,
    required this.tokens,
    required this.cinematic,
    this.validator,
  });

  final String label;
  final TextEditingController controller;
  final bool obscure;
  final VoidCallback onToggle;
  final SvenModeTokens tokens;
  final bool cinematic;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      validator: validator,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      style: TextStyle(color: tokens.onSurface, fontSize: 15),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: tokens.onSurface.withValues(alpha: 0.55)),
        filled: true,
        fillColor:
            cinematic ? tokens.card : tokens.onSurface.withValues(alpha: 0.04),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: tokens.primary.withValues(alpha: 0.6)),
        ),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
            size: 20,
            color: tokens.onSurface.withValues(alpha: 0.45),
          ),
          onPressed: onToggle,
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// App Lock settings page
// ═══════════════════════════════════════════════════════════════════════════

class _AppLockSettingsPage extends StatefulWidget {
  const _AppLockSettingsPage({
    required this.lockService,
    required this.visualMode,
  });

  final AppLockService lockService;
  final VisualMode visualMode;

  @override
  State<_AppLockSettingsPage> createState() => _AppLockSettingsPageState();
}

class _AppLockSettingsPageState extends State<_AppLockSettingsPage> {
  @override
  void initState() {
    super.initState();
    widget.lockService.addListener(_rebuild);
  }

  @override
  void dispose() {
    widget.lockService.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(widget.visualMode);
    final cinematic = widget.visualMode == VisualMode.cinematic;
    final lock = widget.lockService;

    return Scaffold(
      backgroundColor: tokens.scaffold,
      appBar: _svenAppBar(
        context,
        'App Lock',
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          // Enable toggle
          _SettingsTile(
            icon: Icons.lock_outline_rounded,
            title: 'Enable App Lock',
            subtitle: 'Require biometric or PIN when resuming',
            trailing: Switch(
              value: lock.lockEnabled,
              activeThumbColor: tokens.primary,
              onChanged: (v) => lock.setLockEnabled(v),
            ),
            tokens: tokens,
            cinematic: cinematic,
          ),
          if (lock.lockEnabled) ...[
            const SizedBox(height: 8),
            // Timeout picker
            _SettingsTile(
              icon: Icons.timer_outlined,
              title: 'Lock after',
              trailing: DropdownButton<AutoLockTimeout>(
                value: lock.timeout,
                underline: const SizedBox.shrink(),
                isDense: true,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.primary,
                      fontWeight: FontWeight.w600,
                    ),
                items: AutoLockTimeout.values
                    .map(
                        (t) => DropdownMenuItem(value: t, child: Text(t.label)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) lock.setTimeout(v);
                },
              ),
              tokens: tokens,
              cinematic: cinematic,
            ),
            const SizedBox(height: 16),
            // Lock now button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  lock.lockNow();
                  Navigator.of(context).pop();
                },
                icon: const Icon(Icons.lock_rounded, size: 18),
                label: const Text('Lock now'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: tokens.primary,
                  side:
                      BorderSide(color: tokens.primary.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _UserApiKeyModeTile extends StatefulWidget {
  const _UserApiKeyModeTile({
    required this.client,
    required this.tokens,
    required this.cinematic,
  });

  final AuthenticatedClient client;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_UserApiKeyModeTile> createState() => _UserApiKeyModeTileState();
}

class _UserApiKeyModeTileState extends State<_UserApiKeyModeTile> {
  late final UserSettingsService _service;
  bool _loading = true;
  bool _saving = false;
  bool _allowPersonalOverride = true;
  bool _personalMode = false;
  int _configuredCount = 0;
  List<String> _allowedKeys = const [];

  @override
  void initState() {
    super.initState();
    _service = UserSettingsService(client: widget.client);
    _load();
  }

  Future<void> _load() async {
    try {
      final snapshot = await _service.fetchAll();
      if (!mounted) return;
      setState(() {
        _loading = false;
        _allowPersonalOverride = snapshot?.allowPersonalOverride ?? true;
        _personalMode = (snapshot?.mode ?? 'org_default') == 'personal';
        _allowedKeys = snapshot?.allowedKeys ?? const [];
        _configuredCount = snapshot?.rows.length ?? 0;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _setMode(bool personal) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _personalMode = personal;
    });
    final ok = await _service.setValue(
      'keys.mode',
      personal ? 'personal' : 'org_default',
    );
    if (!mounted) return;
    setState(() {
      _saving = false;
      if (!ok) {
        _personalMode = !personal;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = _loading
        ? 'Loading key mode…'
        : !_allowPersonalOverride
            ? 'Disabled by admin policy'
            : _personalMode
                ? 'Using your personal API key refs'
                : 'Using organization default API key refs';

    return Column(
      children: [
        _SettingsTile(
          icon: Icons.vpn_key_rounded,
          title: 'Use personal API keys',
          subtitle: subtitle,
          trailing: Switch.adaptive(
            value: _personalMode,
            onChanged: (!_allowPersonalOverride || _loading || _saving)
                ? null
                : _setMode,
            activeThumbColor: widget.tokens.primary,
          ),
          tokens: widget.tokens,
          cinematic: widget.cinematic,
        ),
        const SizedBox(height: 8),
        _SettingsTile(
          icon: Icons.settings_outlined,
          title: 'Manage personal key refs',
          subtitle: _loading
              ? 'Loading…'
              : 'Configured $_configuredCount / ${_allowedKeys.length} keys',
          trailing: Icon(
            Icons.chevron_right_rounded,
            color: widget.tokens.onSurface.withValues(alpha: 0.35),
            size: 20,
          ),
          onTap: _loading || !_allowPersonalOverride
              ? null
              : () async {
                  await Navigator.of(context).push(
                    SvenPageRoute<void>(
                      builder: (_) => _UserKeyRefsPage(
                        service: _service,
                        tokens: widget.tokens,
                        cinematic: widget.cinematic,
                      ),
                    ),
                  );
                  await _load();
                },
          tokens: widget.tokens,
          cinematic: widget.cinematic,
        ),
      ],
    );
  }
}

class _UserKeyRefsPage extends StatefulWidget {
  const _UserKeyRefsPage({
    required this.service,
    required this.tokens,
    required this.cinematic,
  });

  final UserSettingsService service;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_UserKeyRefsPage> createState() => _UserKeyRefsPageState();
}

class _UserKeyRefsPageState extends State<_UserKeyRefsPage> {
  bool _loading = true;
  bool _saving = false;
  List<String> _allowedKeys = const [];
  final Map<String, TextEditingController> _controllers = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final snapshot = await widget.service.fetchAll();
    final rows = <String, dynamic>{};
    for (final row in snapshot?.rows ?? const <UserScopedSettingRow>[]) {
      rows[row.key] = row.value;
    }
    if (!mounted) return;
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    _controllers.clear();
    final keys = snapshot?.allowedKeys ?? const <String>[];
    for (final key in keys) {
      final value = rows[key];
      _controllers[key] = TextEditingController(text: value?.toString() ?? '');
    }
    setState(() {
      _allowedKeys = keys;
      _loading = false;
    });
  }

  Future<void> _save(String key) async {
    final value = _controllers[key]?.text.trim() ?? '';
    setState(() => _saving = true);
    final ok = value.isEmpty
        ? await widget.service.clearValue(key)
        : await widget.service.setValue(key, value);
    if (!mounted) return;
    setState(() => _saving = false);
    final snackBar = SnackBar(content: Text(ok ? 'Saved $key' : 'Failed to save $key'));
    ScaffoldMessenger.of(context).showSnackBar(snackBar);
  }

  @override
  Widget build(BuildContext context) {
    final tk = widget.tokens;
    return Scaffold(
      backgroundColor: tk.scaffold,
      appBar: _svenAppBar(context, 'Personal Key Refs'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: _allowedKeys.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final key = _allowedKeys[index];
                final controller = _controllers[key]!;
                return Material(
                  color: widget.cinematic
                      ? Colors.white.withValues(alpha: 0.03)
                      : Colors.black.withValues(alpha: 0.02),
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          key,
                          style: TextStyle(
                            color: tk.onSurface,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: controller,
                          style: TextStyle(color: tk.onSurface, fontSize: 13),
                          decoration: InputDecoration(
                            hintText: 'env://MY_PERSONAL_KEY',
                            hintStyle: TextStyle(
                              color: tk.onSurface.withValues(alpha: 0.35),
                              fontSize: 12,
                            ),
                            filled: true,
                            fillColor: tk.surface.withValues(alpha: 0.35),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(
                              onPressed: _saving ? null : () => _save(key),
                              child: const Text('Save'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}

// ── Server picker tile ──

class _ServerTile extends StatefulWidget {
  const _ServerTile({required this.tokens, required this.cinematic});

  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_ServerTile> createState() => _ServerTileState();
}

class _ServerTileState extends State<_ServerTile> {
  late String _currentServer;
  bool _editing = false;
  bool _discovering = false;
  String? _error;
  final _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    _currentServer = ApiBaseService.currentSync();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _discover() async {
    final input = _controller.text.trim();
    if (input.isEmpty) return;
    setState(() {
      _discovering = true;
      _error = null;
    });
    try {
      final result = await ServerDiscoveryService.discover(input);
      final url = await ServerDiscoveryService.applyServer(result);
      if (mounted) {
        setState(() {
          _currentServer = url;
          _editing = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Connected to ${result.instanceName ?? Uri.tryParse(url)?.host ?? url}',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e is StateError ? e.message : e.toString());
      }
    } finally {
      if (mounted) setState(() => _discovering = false);
    }
  }

  Future<void> _reset() async {
    await ServerDiscoveryService.resetToDefault();
    if (mounted) {
      setState(() {
        _currentServer = ApiBaseService.currentSync();
        _editing = false;
        _error = null;
        _controller.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Reset to default server'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = widget.tokens;
    final cinematic = widget.cinematic;
    final serverHost = Uri.tryParse(_currentServer)?.host ?? _currentServer;

    if (!_editing) {
      return _SettingsTile(
        icon: Icons.dns_outlined,
        title: serverHost,
        subtitle: 'Tap to switch Sven server',
        trailing: Icon(
          Icons.chevron_right_rounded,
          color: tokens.onSurface.withValues(alpha: 0.3),
          size: 20,
        ),
        onTap: () => setState(() => _editing = true),
        tokens: tokens,
        cinematic: cinematic,
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cinematic
            ? tokens.primary.withValues(alpha: 0.06)
            : tokens.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: tokens.primary.withValues(alpha: 0.12),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Connect to a Sven server',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'Enter a domain or URL. Auto-discovery will find the gateway.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.onSurface.withValues(alpha: 0.5),
                ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  textInputAction: TextInputAction.go,
                  onSubmitted: (_) => _discover(),
                  autocorrect: false,
                  keyboardType: TextInputType.url,
                  style: TextStyle(
                    color: tokens.onSurface,
                    fontSize: 14,
                  ),
                  decoration: InputDecoration(
                    hintText: 'sven.systems',
                    hintStyle: TextStyle(
                      color: tokens.onSurface.withValues(alpha: 0.3),
                      fontSize: 14,
                    ),
                    prefixIcon: Icon(
                      Icons.language_rounded,
                      size: 18,
                      color: tokens.onSurface.withValues(alpha: 0.35),
                    ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    filled: true,
                    fillColor: tokens.onSurface.withValues(alpha: 0.04),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: tokens.onSurface.withValues(alpha: 0.1),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: tokens.onSurface.withValues(alpha: 0.1),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: tokens.primary.withValues(alpha: 0.5),
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 42,
                child: FilledButton(
                  onPressed: _discovering ? null : _discover,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _discovering
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Connect'),
                ),
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => setState(() {
                  _editing = false;
                  _error = null;
                }),
                child: const Text('Cancel'),
              ),
              TextButton.icon(
                onPressed: _reset,
                icon: const Icon(Icons.restore_rounded, size: 16),
                label: const Text('Reset to default'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.text, required this.tokens});
  final String text;
  final SvenModeTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        color: tokens.onSurface.withValues(alpha: 0.35),
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    required this.tokens,
    required this.cinematic,
    this.destructive = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final SvenModeTokens tokens;
  final bool cinematic;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color =
        destructive ? Theme.of(context).colorScheme.error : tokens.onSurface;

    return Material(
      color: cinematic
          ? Colors.white.withValues(alpha: 0.03)
          : Colors.black.withValues(alpha: 0.02),
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(icon, size: 20, color: color.withValues(alpha: 0.5)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: color,
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: TextStyle(
                          color: color.withValues(alpha: 0.45),
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
      ),
    );
  }
}

class _SegmentedPill extends StatelessWidget {
  const _SegmentedPill({
    required this.value,
    required this.labelTrue,
    required this.labelFalse,
    required this.tokens,
    required this.cinematic,
    required this.onChanged,
  });

  final bool value;
  final String labelTrue;
  final String labelFalse;
  final SvenModeTokens tokens;
  final bool cinematic;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: cinematic
            ? Colors.white.withValues(alpha: 0.06)
            : Colors.black.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _segButton(labelTrue, value, () => onChanged(true)),
          _segButton(labelFalse, !value, () => onChanged(false)),
        ],
      ),
    );
  }

  Widget _segButton(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? tokens.primary.withValues(alpha: 0.15) : null,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active
                ? tokens.primary
                : tokens.onSurface.withValues(alpha: 0.4),
            fontSize: 12,
            fontWeight: active ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

class _PersonalityOverrideTile extends StatefulWidget {
  const _PersonalityOverrideTile({
    required this.memoryService,
    required this.tokens,
    required this.cinematic,
  });

  final MemoryService memoryService;
  final SvenModeTokens tokens;
  final bool cinematic;

  @override
  State<_PersonalityOverrideTile> createState() =>
      _PersonalityOverrideTileState();
}

class _PersonalityOverrideTileState extends State<_PersonalityOverrideTile> {
  late final TextEditingController _ctrl;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _ctrl =
        TextEditingController(text: widget.memoryService.personalityOverride);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _save() {
    widget.memoryService.setPersonalityOverride(_ctrl.text);
    setState(() => _editing = false);
  }

  @override
  Widget build(BuildContext context) {
    final tk = widget.tokens;

    return Material(
      color: widget.cinematic
          ? Colors.white.withValues(alpha: 0.03)
          : Colors.black.withValues(alpha: 0.02),
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.edit_note_rounded,
                    size: 20, color: tk.onSurface.withValues(alpha: 0.5)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Personality notes',
                    style: TextStyle(
                      color: tk.onSurface,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    if (_editing) {
                      _save();
                    } else {
                      setState(() => _editing = true);
                    }
                  },
                  child: Text(
                    _editing ? 'Save' : 'Edit',
                    style: TextStyle(
                      color: tk.primary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_editing)
              TextField(
                controller: _ctrl,
                maxLines: 3,
                minLines: 2,
                maxLength: 300,
                style: TextStyle(color: tk.onSurface, fontSize: 13),
                decoration: InputDecoration(
                  hintText:
                      'e.g. "Always use metric units" or "Be extra concise"',
                  hintStyle: TextStyle(
                    color: tk.onSurface.withValues(alpha: 0.3),
                    fontSize: 12,
                  ),
                  filled: true,
                  fillColor: tk.surface.withValues(alpha: 0.4),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                ),
                onSubmitted: (_) => _save(),
              )
            else
              Text(
                widget.memoryService.personalityOverride.isEmpty
                    ? 'No custom personality notes set.'
                    : widget.memoryService.personalityOverride,
                style: TextStyle(
                  color: tk.onSurface.withValues(alpha: 0.45),
                  fontSize: 12,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Language preference tile
// ═══════════════════════════════════════════════════════════════════════════

class _LanguageTile extends StatelessWidget {
  const _LanguageTile({
    required this.memoryService,
    required this.tokens,
    required this.cinematic,
  });

  final MemoryService memoryService;
  final SvenModeTokens tokens;
  final bool cinematic;

  static const _languages = [
    'auto',
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Dutch',
    'Russian',
    'Japanese',
    'Chinese',
    'Korean',
    'Arabic',
  ];

  String _label(String lang) => lang == 'auto' ? 'Auto-detect' : lang;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: memoryService,
      builder: (_, __) {
        final current = memoryService.preferredLanguage;
        final detected = memoryService.detectedLanguage;
        return _SettingsTile(
          icon: Icons.translate_rounded,
          title: 'Response language',
          subtitle: current == 'auto'
              ? detected.isEmpty
                  ? 'Auto-detect'
                  : 'Auto-detect (detected: $detected)'
              : current,
          trailing: DropdownButton<String>(
            value: current,
            underline: const SizedBox.shrink(),
            isDense: true,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.primary,
                  fontWeight: FontWeight.w600,
                ),
            items: _languages
                .map(
                  (l) => DropdownMenuItem(
                    value: l,
                    child: Text(_label(l)),
                  ),
                )
                .toList(),
            onChanged: (v) {
              if (v != null) memoryService.setPreferredLanguage(v);
            },
          ),
          tokens: tokens,
          cinematic: cinematic,
        );
      },
    );
  }
}

/// Platform-adaptive app bar: [CupertinoNavigationBar] on iOS, [AppBar] elsewhere.
///
/// The return type is [PreferredSizeWidget] so it can be passed directly to
/// [Scaffold.appBar].
PreferredSizeWidget _svenAppBar(
  BuildContext context,
  String title, {
  Widget? leading,
  List<Widget>? actions,
  Color? backgroundColor,
  Color? foregroundColor,
}) {
  if (Platform.isIOS) {
    return CupertinoNavigationBar(
      middle: Text(title),
      leading: leading,
      trailing: actions != null && actions.isNotEmpty
          ? Row(mainAxisSize: MainAxisSize.min, children: actions)
          : null,
      backgroundColor: backgroundColor,
    );
  }
  return AppBar(
    leading: leading,
    title: Text(title),
    actions: actions,
    backgroundColor: backgroundColor,
    foregroundColor: foregroundColor,
  );
}

/// Prettify a TTS voice name for display.
/// Strips locale prefixes and hash suffixes to produce a readable label.
String _voiceDisplayName(String raw) {
  // e.g. "en-us-x-sfg#male_1-local" → "sfg male 1"
  var s = raw;
  // Remove locale prefix like "en-us-x-"
  final hashIdx = s.indexOf('#');
  if (hashIdx > 0) {
    s = s.substring(hashIdx + 1); // "male_1-local"
  } else {
    // Try stripping everything before the last dash-separated segment
    final parts = s.split('-');
    if (parts.length > 3) {
      s = parts.sublist(3).join('-');
    }
  }
  // Remove "-local" / "-network" suffix
  s = s.replaceAll('-local', '').replaceAll('-network', '');
  // Replace underscores with spaces
  s = s.replaceAll('_', ' ');
  // Capitalise first letter
  if (s.isNotEmpty) s = s[0].toUpperCase() + s.substring(1);
  return s.isEmpty ? raw : s;
}

/// Show a dialog to optionally set a PIN for the saved account.
/// Returns the PIN string if set, or null if skipped.
Future<String?> _showSetPinDialog(BuildContext context, SvenModeTokens tokens) async {
  final controller = TextEditingController();
  return showDialog<String?>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: tokens.surface,
      title: Text('Protect with PIN?', style: TextStyle(color: tokens.onSurface)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Set a 4-8 digit PIN to protect account switching. '
            'You can also use device biometrics (fingerprint/face) if App Lock is enabled.',
            style: TextStyle(
                color: tokens.onSurface.withValues(alpha: 0.6), fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: controller,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 8,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: InputDecoration(
              labelText: 'PIN (optional)',
              hintText: '4-8 digits',
              labelStyle: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.6)),
            ),
            style: TextStyle(
                color: tokens.onSurface, fontSize: 24, letterSpacing: 8),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, null),
          child: Text('Skip',
              style: TextStyle(
                  color: tokens.onSurface.withValues(alpha: 0.6))),
        ),
        FilledButton(
          onPressed: () {
            final pin = controller.text;
            Navigator.pop(ctx, pin.length >= 4 ? pin : null);
          },
          child: const Text('Save'),
        ),
      ],
    ),
  );
}

Color? _parseHex(String hex) {
  final h = hex.replaceFirst('#', '');
  if (h.length != 6) return null;
  final v = int.tryParse(h, radix: 16);
  if (v == null) return null;
  return Color(0xFF000000 | v);
}

void _showHexColorPicker(BuildContext context, AppState state, SvenModeTokens tokens) {
  final controller = TextEditingController(text: state.customAccentHex ?? '#');
  showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Custom Accent Colour'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: controller,
            maxLength: 7,
            decoration: const InputDecoration(
              hintText: '#FF6B6B',
              labelText: 'Hex colour',
            ),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[#0-9a-fA-F]')),
            ],
          ),
          const SizedBox(height: 16),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (_, val, __) {
              final c = _parseHex(val.text);
              return Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: c ?? tokens.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: tokens.frame),
                ),
              );
            },
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () {
            state.setCustomAccentHex(null);
            Navigator.pop(ctx);
          },
          child: const Text('Reset'),
        ),
        FilledButton(
          onPressed: () {
            final hex = controller.text;
            if (_parseHex(hex) != null) {
              state.setCustomAccentHex(hex);
            }
            Navigator.pop(ctx);
          },
          child: const Text('Apply'),
        ),
      ],
    ),
  );
}
