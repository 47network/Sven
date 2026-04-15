import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/api_base_service.dart';
import '../../app/server_discovery_service.dart';
import '../../app/sven_app_icon.dart';
import 'auth_errors.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.onSubmit,
    this.initialMessage,
    this.onSsoSignIn,
    this.onServerChanged,
    this.savedAccountName,
    this.onBiometricLogin,
  });

  final Future<void> Function(String username, String password) onSubmit;
  final String? initialMessage;

  /// Called when the user taps a social sign-in button.
  /// [provider] is one of `'google'`, `'apple'`, `'github'`.
  /// Set to `null` to hide the SSO section entirely.
  final Future<void> Function(String provider)? onSsoSignIn;

  /// Called after a successful server switch so the parent can re-initialise.
  final void Function(String gatewayUrl)? onServerChanged;

  /// If a saved account exists on this device, show its name and a biometric
  /// quick-login button.  `null` hides the button.
  final String? savedAccountName;

  /// Called when the user taps the biometric quick-login button.
  final Future<void> Function()? onBiometricLogin;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _serverInput = TextEditingController();
  bool _submitting = false;
  bool _obscure = true;
  String? _error;
  bool _ssoLoading = false;
  String? _ssoError;
  bool _bioLoading = false;
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;

  // Server picker state
  bool _serverExpanded = false;
  bool _serverDiscovering = false;
  String? _serverError;
  ServerDiscoveryResult? _discoveryResult;
  late String _currentServer;

  @override
  void initState() {
    super.initState();
    _currentServer = ApiBaseService.currentSync();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();
    _pulseAnim = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _username.dispose();
    _password.dispose();
    _serverInput.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
      _ssoError = null;
    });
    try {
      HapticFeedback.lightImpact();
      await widget.onSubmit(_username.text.trim(), _password.text);
    } catch (e) {
      if (e is AuthException) {
        setState(() => _error = e.userMessage);
      } else {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _handleSso(String provider) async {
    if (widget.onSsoSignIn == null) return;
    setState(() {
      _ssoLoading = true;
      _ssoError = null;
    });
    try {
      await widget.onSsoSignIn!(provider);
    } catch (e) {
      if (e is AuthException) {
        setState(() => _ssoError = e.userMessage);
      } else {
        setState(() => _ssoError = e.toString());
      }
    } finally {
      if (mounted) setState(() => _ssoLoading = false);
    }
  }

  Future<void> _handleBiometricLogin() async {
    if (widget.onBiometricLogin == null) return;
    setState(() {
      _bioLoading = true;
      _error = null;
    });
    try {
      await widget.onBiometricLogin!();
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e is AuthException
              ? e.userMessage
              : 'Biometric login failed. Please sign in with your password.';
        });
      }
    } finally {
      if (mounted) setState(() => _bioLoading = false);
    }
  }

  Future<void> _discoverServer() async {
    final input = _serverInput.text.trim();
    if (input.isEmpty) {
      setState(() => _serverError = 'Please enter a server address');
      return;
    }
    setState(() {
      _serverDiscovering = true;
      _serverError = null;
      _discoveryResult = null;
    });
    try {
      final result = await ServerDiscoveryService.discover(input);
      final url = await ServerDiscoveryService.applyServer(result);
      if (mounted) {
        setState(() {
          _discoveryResult = result;
          _currentServer = url;
          _serverExpanded = false;
        });
        widget.onServerChanged?.call(url);
      }
    } catch (e) {
      if (mounted) {
        setState(
            () => _serverError = e is StateError ? e.message : e.toString());
      }
    } finally {
      if (mounted) setState(() => _serverDiscovering = false);
    }
  }

  Future<void> _resetServer() async {
    await ServerDiscoveryService.resetToDefault();
    if (mounted) {
      setState(() {
        _currentServer = ApiBaseService.currentSync();
        _discoveryResult = null;
        _serverInput.clear();
        _serverError = null;
      });
      widget.onServerChanged?.call(_currentServer);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primary = Theme.of(context).colorScheme.primary;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: isDark
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF030711),
                    Color(0xFF0A1328),
                    Color(0xFF031A25),
                  ],
                )
              : const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFF5F8FC),
                    Color(0xFFE6EFF8),
                    Color(0xFFDAE8F4),
                  ],
                ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: size.width > 600 ? size.width * 0.2 : 28,
                vertical: 40,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Brand mark ──
                      AnimatedBuilder(
                        animation: _pulseAnim,
                        builder: (context, child) => Transform.scale(
                          scale: _pulseAnim.value,
                          child: child,
                        ),
                        child: const SvenAppIcon(size: 80, borderRadius: 24),
                      ),
                      const SizedBox(height: 32),

                      // ── Heading ──
                      Text(
                        'Welcome back',
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.5,
                                ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Sign in to continue to Sven',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.5),
                            ),
                      ),
                      const SizedBox(height: 36),

                      // ── Error / message ──
                      if (widget.initialMessage != null) ...[
                        _ErrorPill(
                          text: widget.initialMessage!,
                          isWarning: true,
                        ),
                        const SizedBox(height: 16),
                      ],
                      if (_error != null) ...[
                        _ErrorPill(text: _error!),
                        const SizedBox(height: 16),
                      ],
                      if (_ssoError != null) ...[
                        _ErrorPill(text: _ssoError!),
                        const SizedBox(height: 16),
                      ],

                      // ── Username field ──
                      _StyledField(
                        fieldKey: const Key('login_username_field'),
                        controller: _username,
                        hint: 'Username',
                        icon: Icons.person_outline_rounded,
                        isDark: isDark,
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Required' : null,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 14),

                      // ── Password field ──
                      _StyledField(
                        fieldKey: const Key('login_password_field'),
                        controller: _password,
                        hint: 'Password',
                        icon: Icons.lock_outline_rounded,
                        isDark: isDark,
                        obscure: _obscure,
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 20,
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withValues(alpha: 0.35),
                          ),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                        validator: (v) =>
                            (v == null || v.isEmpty) ? 'Required' : null,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                      ),
                      const SizedBox(height: 28),

                      // ── Sign in button ──
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: Semantics(
                          label: _submitting
                              ? 'Signing in, please wait'
                              : 'Sign in',
                          button: true,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              gradient: LinearGradient(
                                colors: isDark
                                    ? [
                                        const Color(0xFF00D9FF),
                                        const Color(0xFF00C4E0),
                                      ]
                                    : [
                                        primary,
                                        primary.withValues(alpha: 0.85)
                                      ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: primary.withValues(
                                      alpha: _submitting ? 0.1 : 0.3),
                                  blurRadius: _submitting ? 8 : 16,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                key: const Key('login_submit_button'),
                                borderRadius: BorderRadius.circular(14),
                                onTap: _submitting ? null : _submit,
                                child: Center(
                                  child: _submitting
                                      ? SizedBox(
                                          width: 22,
                                          height: 22,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: isDark
                                                ? const Color(0xFF040712)
                                                : Colors.white,
                                          ),
                                        )
                                      : Text(
                                          'Sign in',
                                          style: TextStyle(
                                            color: isDark
                                                ? const Color(0xFF040712)
                                                : Colors.white,
                                            fontSize: 16,
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: 0.3,
                                          ),
                                        ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // ── Biometric quick-login ──
                      if (widget.savedAccountName != null &&
                          widget.onBiometricLogin != null) ...[
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: OutlinedButton.icon(
                            icon: _bioLoading
                                ? SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: primary,
                                    ),
                                  )
                                : Icon(Icons.fingerprint, color: primary),
                            label: Text(
                              'Sign in as ${widget.savedAccountName}',
                              style: TextStyle(
                                color: isDark ? Colors.white70 : primary,
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                color: primary.withValues(alpha: 0.4),
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            onPressed:
                                _bioLoading ? null : _handleBiometricLogin,
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // ── SSO divider + buttons ──
                      if (widget.onSsoSignIn != null) ...[
                        _SsoDivider(isDark: isDark),
                        const SizedBox(height: 20),
                        _SsoButton(
                          label: 'Continue with Google',
                          icon: Icons.g_mobiledata_rounded,
                          iconColor: const Color(0xFF4285F4),
                          isDark: isDark,
                          loading: _ssoLoading,
                          onTap: () => _handleSso('google'),
                        ),
                        const SizedBox(height: 10),
                        _SsoButton(
                          label: 'Continue with Apple',
                          icon: Icons.apple_rounded,
                          iconColor: isDark ? Colors.white : Colors.black,
                          isDark: isDark,
                          loading: _ssoLoading,
                          onTap: () => _handleSso('apple'),
                        ),
                        const SizedBox(height: 10),
                        _SsoButton(
                          label: 'Continue with GitHub',
                          icon: Icons.code_rounded,
                          iconColor: isDark
                              ? const Color(0xFFC9D1D9)
                              : const Color(0xFF24292F),
                          isDark: isDark,
                          loading: _ssoLoading,
                          onTap: () => _handleSso('github'),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // ── Server picker (Element-style) ──
                      _ServerPickerSection(
                        currentServer: _currentServer,
                        expanded: _serverExpanded,
                        discovering: _serverDiscovering,
                        error: _serverError,
                        discoveryResult: _discoveryResult,
                        serverInput: _serverInput,
                        isDark: isDark,
                        onToggle: () =>
                            setState(() => _serverExpanded = !_serverExpanded),
                        onDiscover: _discoverServer,
                        onReset: _resetServer,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── SSO divider ──

class _SsoDivider extends StatelessWidget {
  const _SsoDivider({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final lineColor = isDark
        ? Colors.white.withValues(alpha: 0.12)
        : Colors.black.withValues(alpha: 0.10);
    return Row(
      children: [
        Expanded(child: Divider(color: lineColor, thickness: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text(
            'or continue with',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.40),
                  letterSpacing: 0.3,
                ),
          ),
        ),
        Expanded(child: Divider(color: lineColor, thickness: 1)),
      ],
    );
  }
}

// ── SSO button ──

class _SsoButton extends StatelessWidget {
  const _SsoButton({
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.isDark,
    required this.loading,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color iconColor;
  final bool isDark;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.10)
        : Colors.black.withValues(alpha: 0.10);
    final fillColor = isDark
        ? Colors.white.withValues(alpha: 0.035)
        : Colors.white.withValues(alpha: 0.75);

    return Semantics(
      button: true,
      label: label,
      child: SizedBox(
        width: double.infinity,
        height: 48,
        child: Material(
          color: fillColor,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: loading ? null : onTap,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: borderColor),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  loading
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        )
                      : Icon(icon, size: 20, color: iconColor),
                  const SizedBox(width: 10),
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.80),
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StyledField extends StatelessWidget {
  const _StyledField({
    this.fieldKey,
    required this.controller,
    required this.hint,
    required this.icon,
    required this.isDark,
    this.obscure = false,
    this.suffixIcon,
    this.validator,
    this.textInputAction,
    this.onFieldSubmitted,
  });

  final Key? fieldKey;
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool isDark;
  final bool obscure;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;

  @override
  Widget build(BuildContext context) {
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : Colors.black.withValues(alpha: 0.08);
    final fillColor = isDark
        ? Colors.white.withValues(alpha: 0.04)
        : Colors.white.withValues(alpha: 0.8);

    return TextFormField(
      key: fieldKey,
      controller: controller,
      obscureText: obscure,
      validator: validator,
      textInputAction: textInputAction,
      onFieldSubmitted: onFieldSubmitted,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface,
        fontSize: 15,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color:
              Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.35),
          fontSize: 15,
        ),
        prefixIcon: Icon(
          icon,
          size: 20,
          color:
              Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.35),
        ),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: fillColor,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
            width: 1.5,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.error.withValues(alpha: 0.6),
          ),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.error,
            width: 1.5,
          ),
        ),
      ),
    );
  }
}

// ── Error pill ──

class _ErrorPill extends StatelessWidget {
  const _ErrorPill({required this.text, this.isWarning = false});

  final String text;
  final bool isWarning;

  @override
  Widget build(BuildContext context) {
    final color = isWarning
        ? Theme.of(context).colorScheme.tertiary
        : Theme.of(context).colorScheme.error;
    return Semantics(
      liveRegion: true,
      label: isWarning ? text : 'Error: $text',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(
              isWarning ? Icons.info_outline_rounded : Icons.error_outline,
              size: 18,
              color: color,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Server picker section ──

class _ServerPickerSection extends StatelessWidget {
  const _ServerPickerSection({
    required this.currentServer,
    required this.expanded,
    required this.discovering,
    this.error,
    this.discoveryResult,
    required this.serverInput,
    required this.isDark,
    required this.onToggle,
    required this.onDiscover,
    required this.onReset,
  });

  final String currentServer;
  final bool expanded;
  final bool discovering;
  final String? error;
  final ServerDiscoveryResult? discoveryResult;
  final TextEditingController serverInput;
  final bool isDark;
  final VoidCallback onToggle;
  final VoidCallback onDiscover;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final muted =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45);
    final serverHost = Uri.tryParse(currentServer)?.host ?? currentServer;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Tap to expand/collapse
        GestureDetector(
          onTap: onToggle,
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.dns_outlined, size: 14, color: muted),
                const SizedBox(width: 6),
                Text(
                  serverHost,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: muted,
                        letterSpacing: 0.2,
                      ),
                ),
                const SizedBox(width: 4),
                Icon(
                  expanded ? Icons.expand_less : Icons.expand_more,
                  size: 16,
                  color: muted,
                ),
              ],
            ),
          ),
        ),

        // Expanded server entry
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 200),
          crossFadeState:
              expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
          firstChild: const SizedBox.shrink(),
          secondChild: _buildExpanded(context),
        ),
      ],
    );
  }

  Widget _buildExpanded(BuildContext context) {
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.10)
        : Colors.black.withValues(alpha: 0.10);

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.03)
                  : Colors.white.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderColor),
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
                  'Enter a domain or server URL. Auto-discovery will find the gateway.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.5),
                      ),
                ),
                const SizedBox(height: 14),

                // Server URL input
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: serverInput,
                        textInputAction: TextInputAction.go,
                        onSubmitted: (_) => onDiscover(),
                        autocorrect: false,
                        keyboardType: TextInputType.url,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          fontSize: 14,
                        ),
                        decoration: InputDecoration(
                          hintText: 'sven.systems',
                          hintStyle: TextStyle(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withValues(alpha: 0.3),
                            fontSize: 14,
                          ),
                          prefixIcon: Icon(
                            Icons.language_rounded,
                            size: 18,
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withValues(alpha: 0.35),
                          ),
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 12),
                          filled: true,
                          fillColor: isDark
                              ? Colors.white.withValues(alpha: 0.04)
                              : Colors.white.withValues(alpha: 0.8),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(color: borderColor),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(color: borderColor),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide(
                              color: Theme.of(context)
                                  .colorScheme
                                  .primary
                                  .withValues(alpha: 0.5),
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
                        onPressed: discovering ? null : onDiscover,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: discovering
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

                // Error
                if (error != null) ...[
                  const SizedBox(height: 10),
                  _ErrorPill(text: error!),
                ],

                // Success info
                if (discoveryResult != null) ...[
                  const SizedBox(height: 10),
                  _DiscoverySuccessChip(result: discoveryResult!),
                ],

                // Reset to default
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: onReset,
                    icon: const Icon(Icons.restore_rounded, size: 16),
                    label: const Text('Reset to default'),
                    style: TextButton.styleFrom(
                      textStyle: const TextStyle(fontSize: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Discovery success chip ──

class _DiscoverySuccessChip extends StatelessWidget {
  const _DiscoverySuccessChip({required this.result});

  final ServerDiscoveryResult result;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    final name = result.instanceName ?? 'Sven Server';
    final version = result.version != null ? ' v${result.version}' : '';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(Icons.check_circle_rounded, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Connected to $name$version',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
