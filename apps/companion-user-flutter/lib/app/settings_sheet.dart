import 'dart:io';
import 'package:flutter/cupertino.dart' show CupertinoNavigationBar;
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FilteringTextInputFormatter;

import 'ab_test_override_page.dart';
import 'ab_test_service.dart';
import 'api_base_service.dart';
import 'app_models.dart';
import 'app_state.dart';
import 'authenticated_client.dart';
import 'server_discovery_service.dart';
import 'service_locator.dart';
import 'sven_page_route.dart';
import 'sven_tokens.dart';
import '../features/approvals/approvals_page.dart';
import '../features/chat/voice_service.dart';
import '../features/deployment/deployment_service.dart';
import '../features/auth/auth_service.dart';
import '../features/auth/account_picker_sheet.dart';
import '../features/auth/mfa_setup_sheet.dart';
import '../features/devices/device_manager_page.dart';
import '../features/devices/device_service.dart';
import '../features/entity/sven_entity_page.dart';
import '../features/memory/memory_page.dart';
import '../features/memory/memory_service.dart';
import '../features/notifications/notifications_page.dart';
import '../features/notifications/notification_prefs_service.dart';
import '../features/notifications/notification_prefs_page.dart';
import '../features/preferences/user_settings_service.dart';
import '../features/projects/project_picker_sheet.dart';
import '../features/projects/project_service.dart';
import '../features/security/app_lock_service.dart';
import '../features/profile/profile_page.dart';
import '../features/profile/profile_service.dart';
import '../features/organizations/org_switcher_service.dart';
import '../features/organizations/org_switcher_page.dart';
import '../features/activity/activity_feed_service.dart';
import '../features/activity/activity_feed_page.dart';
import '../features/brain/brain_page.dart';
import '../features/brain/brain_service.dart';
import '../features/chat/search_page.dart';
import '../features/inference/inference_page.dart';
import '../features/inference/on_device_inference_service.dart';
import '../features/ai/ai_hub_page.dart';
import '../features/ai/image_analysis_page.dart';
import '../features/ai/audio_scribe_page.dart';
import '../features/ai/device_actions_page.dart';
import '../features/ai/smart_routing_page.dart';
import '../features/ai/ai_modules_page.dart';
import '../features/ai/brain_admin_page.dart';
import '../features/ai/brain_admin_service.dart';
import '../features/ai/calibration_page.dart';
import '../features/ai/calibration_service.dart';
import '../features/ai/community_agents_page.dart';
import '../features/ai/community_agents_service.dart';
import '../features/ai/federation_page.dart';
import '../features/ai/federation_service.dart';
import '../features/ai/privacy_controls_page.dart';
import '../features/settings/privacy_page.dart';


part 'settings_sub_pages.dart';

class SettingsSheet extends StatelessWidget {
  const SettingsSheet({
    super.key,
    required this.state,
    required this.client,
    required this.onLogout,
    required this.onLogoutAll,
    // ignore: unused_element_parameter
    this.memoryService,
    this.lockService,
    this.voiceService,
    this.deviceService,
    this.projectService,
    this.authService,
    this.onReopenSettings,
  });

  final AppState state;
  final AuthenticatedClient client;
  final Future<void> Function() onLogout;
  final Future<void> Function() onLogoutAll;
  final MemoryService? memoryService;
  final AppLockService? lockService;
  final VoiceService? voiceService;
  final DeviceService? deviceService;
  final ProjectService? projectService;
  final AuthService? authService;
  final VoidCallback? onReopenSettings;

  /// Close the sheet, push [page], and re-open settings when the user
  /// navigates back. This fixes the broken "back returns to main" UX.
  void _openSubPage(BuildContext context, Widget page) {
    final reopen = onReopenSettings;
    Navigator.of(context).pop();
    Navigator.of(context)
        .push(SvenPageRoute<void>(builder: (_) => page))
        .then((_) {
      if (reopen != null) reopen();
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = SvenTokens.forMode(state.visualMode);
    final cinematic = state.visualMode == VisualMode.cinematic;
    final reduceMotion = MediaQuery.of(context).disableAnimations;

    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        return DraggableScrollableSheet(
          initialChildSize: 0.65,
          minChildSize: 0.35,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Handle
                    Center(
                      child: Container(
                        width: 36,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 20),
                        decoration: BoxDecoration(
                          color: tokens.onSurface.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    // Title
                    Text(
                      'Settings',
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                    ),
                    const SizedBox(height: 24),

                    // ── Voice ──
                    if (voiceService != null) ...[
                      _SectionLabel(text: 'Voice', tokens: tokens),
                      const SizedBox(height: 12),
                      ListenableBuilder(
                        listenable: voiceService!,
                        builder: (_, __) => _SettingsTile(
                          icon: Icons.record_voice_over_outlined,
                          title: 'Auto-read responses',
                          subtitle: 'Speak AI replies automatically',
                          trailing: Switch.adaptive(
                            value: voiceService!.autoReadAloud,
                            onChanged: voiceService!.setAutoReadAloud,
                            activeThumbColor: tokens.primary,
                          ),
                          tokens: tokens,
                          cinematic: cinematic,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.hearing_rounded,
                        title: 'Voice wake',
                        subtitle:
                            'Say "${state.wakeWordPhrase}" to open hands-free voice capture while the app is active',
                        trailing: Switch.adaptive(
                          value: state.wakeWordEnabled,
                          onChanged: state.setWakeWordEnabled,
                          activeThumbColor: tokens.primary,
                        ),
                        onTap: () => state.setWakeWordEnabled(!state.wakeWordEnabled),
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.keyboard_voice_rounded,
                        title: 'Wake phrase',
                        subtitle: state.wakeWordPhrase,
                        trailing: Icon(Icons.chevron_right_rounded,
                            color: tokens.onSurface.withValues(alpha: 0.45)),
                        onTap: () async {
                          final controller = TextEditingController(text: state.wakeWordPhrase);
                          final value = await showDialog<String>(
                            context: context,
                            builder: (dialogContext) => AlertDialog(
                              title: const Text('Wake phrase'),
                              content: TextField(
                                controller: controller,
                                autofocus: true,
                                decoration: const InputDecoration(
                                  hintText: 'Hey Sven',
                                ),
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.of(dialogContext).pop(),
                                  child: const Text('Cancel'),
                                ),
                                FilledButton(
                                  onPressed: () => Navigator.of(dialogContext).pop(controller.text),
                                  child: const Text('Save'),
                                ),
                              ],
                            ),
                          );
                          if (value != null) {
                            await state.setWakeWordPhrase(value);
                          }
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                      // ── Voice picker ──
                      FutureBuilder<List<dynamic>>(
                        future: voiceService!.getAvailableVoices(),
                        builder: (ctx, snap) {
                          if (!snap.hasData || snap.data!.isEmpty) {
                            return const SizedBox.shrink();
                          }
                          // Filter to English voices only
                          final voices = snap.data!.whereType<Map>().where((v) {
                            final locale =
                                (v['locale'] ?? '').toString().toLowerCase();
                            return locale.startsWith('en');
                          }).toList()
                            ..sort((a, b) => (a['name'] ?? '')
                                .toString()
                                .compareTo((b['name'] ?? '').toString()));
                          if (voices.isEmpty) return const SizedBox.shrink();
                          final current = voiceService!.selectedVoiceName;
                          return _SettingsTile(
                            icon: Icons.graphic_eq_rounded,
                            title: 'Voice',
                            subtitle: current != null
                                ? _voiceDisplayName(current)
                                : 'System default',
                            trailing: SizedBox(
                              width: 140,
                              child: DropdownButton<String>(
                                value: current,
                                underline: const SizedBox.shrink(),
                                isDense: true,
                                isExpanded: true,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: tokens.primary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                hint: Text('Default',
                                    style: TextStyle(
                                        color: tokens.onSurface
                                            .withValues(alpha: 0.5),
                                        fontSize: 12)),
                                items:
                                    voices.map<DropdownMenuItem<String>>((v) {
                                  final name = v['name'].toString();
                                  return DropdownMenuItem(
                                    value: name,
                                    child: Text(
                                      _voiceDisplayName(name),
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 12),
                                    ),
                                  );
                                }).toList(),
                                onChanged: (name) {
                                  if (name == null) return;
                                  final voice = voices.firstWhere(
                                      (v) => v['name'].toString() == name);
                                  final locale =
                                      voice['locale']?.toString() ?? 'en-US';
                                  voiceService!.setVoice(name, locale);
                                  state.setTtsVoice('$name|$locale');
                                },
                              ),
                            ),
                            tokens: tokens,
                            cinematic: cinematic,
                          );
                        },
                      ),
                      const SizedBox(height: 8),
                      ListenableBuilder(
                        listenable: voiceService!,
                        builder: (_, __) => Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _SettingsTile(
                              icon: Icons.speed_rounded,
                              title: 'Speaking speed',
                              subtitle:
                                  '${voiceService!.ttsSpeed.toStringAsFixed(1)}×',
                              trailing: SizedBox(
                                width: 140,
                                child: Slider(
                                  value: voiceService!.ttsSpeed,
                                  min: 0.5,
                                  max: 2.0,
                                  divisions: 6,
                                  onChanged: (v) {
                                    voiceService!.setSpeed(v);
                                    state.setTtsSpeed(v);
                                  },
                                  activeColor: tokens.primary,
                                ),
                              ),
                              tokens: tokens,
                              cinematic: cinematic,
                            ),
                            const SizedBox(height: 4),
                            _SettingsTile(
                              icon: Icons.tune_rounded,
                              title: 'Voice pitch',
                              subtitle:
                                  voiceService!.ttsPitch.toStringAsFixed(1),
                              trailing: SizedBox(
                                width: 140,
                                child: Slider(
                                  value: voiceService!.ttsPitch,
                                  min: 0.5,
                                  max: 2.0,
                                  divisions: 6,
                                  onChanged: (v) {
                                    voiceService!.setPitch(v);
                                    state.setTtsPitch(v);
                                  },
                                  activeColor: tokens.primary,
                                ),
                              ),
                              tokens: tokens,
                              cinematic: cinematic,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // ── Personality ──
                    _SectionLabel(text: 'Personality', tokens: tokens),
                    const SizedBox(height: 12),
                    _SettingsTile(
                      icon: Icons.mood_rounded,
                      title: 'Sven\'s tone',
                      subtitle: state.voicePersonality.description,
                      trailing: DropdownButton<VoicePersonality>(
                        value: state.voicePersonality,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                        items: VoicePersonality.values
                            .map((p) => DropdownMenuItem(
                                  value: p,
                                  child: Text('${p.icon} ${p.label}'),
                                ))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) state.setVoicePersonality(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    // Personality override / custom notes
                    if (memoryService != null) ...[
                      const SizedBox(height: 8),
                      _PersonalityOverrideTile(
                        memoryService: memoryService!,
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                      _LanguageTile(
                        memoryService: memoryService!,
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                    ],
                    const SizedBox(height: 24),

                    // ── Appearance ──
                    _SectionLabel(text: 'Appearance', tokens: tokens),
                    const SizedBox(height: 12),
                    _SettingsTile(
                      icon: Icons.palette_outlined,
                      title: 'Theme',
                      trailing: _SegmentedPill(
                        value: state.visualMode == VisualMode.classic,
                        labelTrue: 'Light',
                        labelFalse: 'Dark',
                        tokens: tokens,
                        cinematic: cinematic,
                        onChanged: (isClassic) => state.setVisualMode(
                          isClassic ? VisualMode.classic : VisualMode.cinematic,
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // Accent colour swatches
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.circle_outlined,
                                  size: 20,
                                  color:
                                      tokens.onSurface.withValues(alpha: 0.55)),
                              const SizedBox(width: 12),
                              Text(
                                'Accent colour',
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w500,
                                    ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: AccentPreset.values.map((preset) {
                              final isActive = state.accentPreset == preset;
                              final color = Color(preset.argbValue);
                              return GestureDetector(
                                onTap: () => state.setAccentPreset(preset),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  width: 36,
                                  height: 36,
                                  margin: const EdgeInsets.only(right: 10),
                                  decoration: BoxDecoration(
                                    color: color,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: isActive
                                          ? tokens.onSurface
                                          : Colors.transparent,
                                      width: 2.5,
                                    ),
                                    boxShadow: isActive
                                        ? [
                                            BoxShadow(
                                              color:
                                                  color.withValues(alpha: 0.55),
                                              blurRadius: 8,
                                              spreadRadius: 1,
                                            )
                                          ]
                                        : null,
                                  ),
                                  child: isActive
                                      ? const Icon(Icons.check_rounded,
                                          size: 18, color: Colors.white)
                                      : null,
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.animation_outlined,
                      title: 'Motion',
                      subtitle:
                          reduceMotion ? 'System reduced motion on' : null,
                      trailing: DropdownButton<MotionLevel>(
                        value: state.motionLevel,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                        items: MotionLevel.values
                            .map((m) => DropdownMenuItem(
                                value: m, child: Text(m.label)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) state.setMotionLevel(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Sven\'s form',
                      subtitle:
                          '${state.avatarMode.icon}\u2002${state.avatarMode.entityName}\u2002·\u2002${state.avatarMode.label}',
                      trailing: Icon(Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.45)),
                      onTap: () {
                        showModalBottomSheet<void>(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => DraggableScrollableSheet(
                            initialChildSize: 0.92,
                            minChildSize: 0.5,
                            maxChildSize: 0.95,
                            builder: (ctx, ctrl) => ClipRRect(
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(28)),
                              child: SvenEntityPage(
                                currentMode: state.avatarMode,
                                onChanged: state.setAvatarMode,
                                visualMode: state.effectiveVisualMode,
                                motionLevel: state.effectiveMotionLevel,
                                personality: state.voicePersonality,
                              ),
                            ),
                          ),
                        );
                      },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.short_text_rounded,
                      title: 'Response length',
                      subtitle: state.responseLength.description,
                      trailing: DropdownButton<ResponseLength>(
                        value: state.responseLength,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                        items: ResponseLength.values
                            .map((r) => DropdownMenuItem(
                                value: r, child: Text(r.label)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) state.setResponseLength(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.contrast_rounded,
                      title: 'High contrast',
                      subtitle: 'Maximise text-to-background contrast',
                      trailing: Switch(
                        value: state.highContrast,
                        activeThumbColor: tokens.primary,
                        onChanged: state.setHighContrast,
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.palette_outlined,
                      title: 'Colour-blind mode',
                      subtitle: 'Blue/orange palette — safe for red-green CVD',
                      trailing: Switch(
                        value: state.colorBlindMode,
                        activeThumbColor: tokens.primary,
                        onChanged: state.setColorBlindMode,
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.blur_off_rounded,
                      title: 'Reduce transparency',
                      subtitle: 'Replace frosted glass with solid backgrounds',
                      trailing: Switch(
                        value: state.reduceTransparency,
                        activeThumbColor: tokens.primary,
                        onChanged: state.setReduceTransparency,
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.text_fields_rounded,
                      title: 'Text size',
                      subtitle: '${(state.textScale * 100).round()}%',
                      trailing: SizedBox(
                        width: 140,
                        child: Slider(
                          value: state.textScale,
                          min: 0.8,
                          max: 1.5,
                          divisions: 7,
                          activeColor: tokens.primary,
                          label: '${(state.textScale * 100).round()}%',
                          onChanged: (v) => state.setTextScale(v),
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // Custom accent hex
                    _SettingsTile(
                      icon: Icons.colorize_rounded,
                      title: 'Custom colour',
                      subtitle: state.customAccentHex ?? 'Tap to pick',
                      trailing: GestureDetector(
                        onTap: () => _showHexColorPicker(context, state, tokens),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: state.customAccentHex != null
                                ? _parseHex(state.customAccentHex!)
                                : tokens.primary,
                            shape: BoxShape.circle,
                            border: Border.all(color: tokens.frame, width: 1),
                          ),
                        ),
                      ),
                      onTap: () => _showHexColorPicker(context, state, tokens),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // Font family
                    _SettingsTile(
                      icon: Icons.font_download_outlined,
                      title: 'Font',
                      trailing: DropdownButton<FontFamily>(
                        value: state.fontFamily,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                        items: FontFamily.values
                            .map((f) => DropdownMenuItem(
                                value: f, child: Text(f.label)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) state.setFontFamily(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // UI density
                    _SettingsTile(
                      icon: Icons.density_medium_rounded,
                      title: 'Density',
                      trailing: DropdownButton<UiDensity>(
                        value: state.uiDensity,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: tokens.primary,
                              fontWeight: FontWeight.w600,
                            ),
                        items: UiDensity.values
                            .map((d) => DropdownMenuItem(
                                value: d, child: Text(d.label)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) state.setUiDensity(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 24),

                    // ── API Keys ──
                    _SectionLabel(text: 'API Keys', tokens: tokens),
                    const SizedBox(height: 12),
                    _UserApiKeyModeTile(
                      client: client,
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 24),

                    // ── Navigation ──
                    _SectionLabel(text: 'More', tokens: tokens),
                    const SizedBox(height: 12),
                    if (memoryService != null) ...[
                      _SettingsTile(
                        icon: Icons.psychology_outlined,
                        title: 'Memory & Instructions',
                        subtitle: 'Personalise Sven\'s responses',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        onTap: () => _openSubPage(
                          context,
                          MemoryPage(visualMode: state.visualMode),
                        ),
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                    ],
                    // ── Brain ──
                    _SettingsTile(
                      icon: Icons.hub_outlined,
                      title: 'Brain',
                      subtitle: 'Knowledge graph & memory map',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        BrainPage(brainService: BrainService(client: client)),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // ── Search ──
                    _SettingsTile(
                      icon: Icons.search_rounded,
                      title: 'Search',
                      subtitle: 'Full-text & semantic search',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        SearchPage(client: client, visualMode: state.visualMode),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // ── AI Hub ──
                    _SettingsTile(
                      icon: Icons.auto_awesome_rounded,
                      title: 'AI Hub',
                      subtitle: 'Image, scribe, actions, modules & more',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () {
                        final inferSvc = OnDeviceInferenceService(client: client);
                        _openSubPage(
                          context,
                          AiHubPage(
                            client: client,
                            inferenceService: inferSvc,
                            brainService: BrainService(client: client),
                            onNavigate: (route, navCtx) {
                                Widget? page;
                                switch (route) {
                                  case 'inference':
                                    page = InferencePage(inferenceService: inferSvc);
                                  case 'brain':
                                    page = BrainPage(brainService: BrainService(client: client));
                                  case 'ai/image':
                                    page = ImageAnalysisPage(client: client, inferenceService: inferSvc);
                                  case 'ai/scribe':
                                    page = AudioScribePage(client: client, inferenceService: inferSvc);
                                  case 'ai/actions':
                                    page = DeviceActionsPage(client: client, inferenceService: inferSvc);
                                  case 'ai/routing':
                                    page = SmartRoutingPage(client: client);
                                  case 'ai/modules':
                                    page = AiModulesPage(client: client);
                                  case 'ai/privacy':
                                    page = PrivacyControlsPage(client: client);
                                  case 'ai/brain-admin':
                                    page = BrainAdminPage(service: BrainAdminService(client: client));
                                  case 'ai/community-agents':
                                    page = CommunityAgentsPage(service: CommunityAgentsService(client: client));
                                  case 'ai/calibration':
                                    page = CalibrationPage(service: CalibrationService(client: client));
                                  case 'ai/federation':
                                    page = FederationPage(service: FederationService(client: client));
                                }
                                if (page != null) {
                                  Navigator.of(navCtx).push(
                                    SvenPageRoute<void>(builder: (_) => page!),
                                  );
                                }
                            },
                          ),
                        );
                      },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // ── On-device Inference ──
                    _SettingsTile(
                      icon: Icons.memory_rounded,
                      title: 'Inference',
                      subtitle: 'Local AI model management',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        InferencePage(
                          inferenceService:
                              OnDeviceInferenceService(client: client),
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // ── Projects ──
                    if (projectService != null) ...[
                      _SettingsTile(
                        icon: Icons.folder_special_rounded,
                        title: 'Project Spaces',
                        subtitle: 'Group conversations by project',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        onTap: () {
                          final reopen = onReopenSettings;
                          Navigator.of(context).pop();
                          showModalBottomSheet<void>(
                            context: context,
                            isScrollControlled: true,
                            useSafeArea: true,
                            builder: (_) => ProjectsSheet(
                              service: projectService!,
                              visualMode: state.visualMode,
                            ),
                          ).then((_) {
                            if (reopen != null) reopen();
                          });
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                    ],
                    // ── Workspaces / Org Switcher ──
                    _SettingsTile(
                      icon: Icons.workspaces_outlined,
                      title: 'Workspaces',
                      subtitle: 'Switch organisation',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        OrgSwitcherPage(
                          service: OrgSwitcherService(client),
                          visualMode: state.visualMode,
                          onSwitched: () {},
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    // ── Activity Feed ──
                    _SettingsTile(
                      icon: Icons.timeline_outlined,
                      title: 'Activity',
                      subtitle: 'Unified event timeline',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        ActivityFeedPage(
                          service: ActivityFeedService(client),
                          visualMode: state.visualMode,
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.check_circle_outline_rounded,
                      title: 'Approvals',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        ApprovalsPage(client: client),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.notifications_outlined,
                      title: 'Notifications',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        const NotificationsPage(),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.tune_rounded,
                      title: 'Notification Preferences',
                      subtitle: 'Per-channel sound, vibrate & DND',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        NotificationPrefsPage(
                          prefsService: NotificationPrefsService(client),
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.do_not_disturb_rounded,
                      title: 'Do Not Disturb',
                      subtitle: state.dndEnabled
                          ? 'On · ${state.dndScheduleLabel}'
                          : 'Off',
                      trailing: Switch.adaptive(
                        value: state.dndEnabled,
                        activeThumbColor: tokens.primary,
                        onChanged: (v) => state.setDndEnabled(v),
                      ),
                      onTap: () async {
                        if (!state.dndEnabled) {
                          await state.setDndEnabled(true);
                          return;
                        }
                        // Show time picker for DND window
                        if (!context.mounted) return;
                        final startTime = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay(
                            hour: state.dndStartHour,
                            minute: state.dndStartMinute,
                          ),
                          helpText: 'DND starts at',
                        );
                        if (startTime == null || !context.mounted) return;
                        final endTime = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay(
                            hour: state.dndEndHour,
                            minute: state.dndEndMinute,
                          ),
                          helpText: 'DND ends at',
                        );
                        if (endTime == null) return;
                        await state.setDndSchedule(
                          startHour: startTime.hour,
                          startMinute: startTime.minute,
                          endHour: endTime.hour,
                          endMinute: endTime.minute,
                        );
                      },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.volume_up_rounded,
                      title: 'Notification sound',
                      subtitle: state.notifSound == 'silent'
                          ? 'Silent'
                          : state.notifSound == 'subtle'
                              ? 'Subtle'
                              : 'Default',
                      trailing: DropdownButton<String>(
                        value: state.notifSound,
                        underline: const SizedBox.shrink(),
                        isDense: true,
                        items: const [
                          DropdownMenuItem(
                              value: 'default', child: Text('Default')),
                          DropdownMenuItem(
                              value: 'subtle', child: Text('Subtle')),
                          DropdownMenuItem(
                              value: 'silent', child: Text('Silent')),
                        ],
                        onChanged: (v) {
                          if (v != null) state.setNotifSound(v);
                        },
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    if (deviceService != null) ...[
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.devices_other_rounded,
                        title: 'Devices',
                        subtitle: 'Mirrors, kiosks & sensors',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        onTap: () => _openSubPage(
                          context,
                          DeviceManagerPage(
                            deviceService: deviceService!,
                            visualMode: state.visualMode,
                          ),
                        ),
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                    ],
                    if (lockService != null) ...[
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.lock_outline_rounded,
                        title: 'App Lock',
                        subtitle: lockService!.lockEnabled
                            ? 'On · ${lockService!.timeout.label}'
                            : 'Off',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.3),
                          size: 20,
                        ),
                        onTap: () => _openSubPage(
                          context,
                          _AppLockSettingsPage(
                            lockService: lockService!,
                            visualMode: state.visualMode,
                          ),
                        ),
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                    ],
                    const SizedBox(height: 8),
                    _SettingsTile(
                      icon: Icons.privacy_tip_outlined,
                      title: 'Privacy & Data',
                      subtitle: 'Analytics consent, legal, data management',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        PrivacyPage(
                          state: state,
                          visualMode: state.visualMode,
                          onClearData: () => onLogout(),
                          memoryService: memoryService,
                          authService: authService,
                        ),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 32),

                    // ── Server ──
                    _SectionLabel(text: 'Server', tokens: tokens),
                    const SizedBox(height: 12),
                    _ServerTile(
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 32),

                    // ── Account ──
                    _SectionLabel(text: 'Account', tokens: tokens),
                    const SizedBox(height: 12),

                    // User identity card
                    Container(
                      padding: const EdgeInsets.all(14),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: cinematic
                            ? tokens.primary.withValues(alpha: 0.08)
                            : tokens.primary.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: tokens.primary.withValues(alpha: 0.12),
                        ),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor:
                                tokens.primary.withValues(alpha: 0.15),
                            child: Text(
                              (state.username ?? '?')
                                  .substring(0, 1)
                                  .toUpperCase(),
                              style: TextStyle(
                                color: tokens.primary,
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  state.username ?? 'User',
                                  style: TextStyle(
                                    color: tokens.onSurface,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 15,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  state.deploymentMode ==
                                          DeploymentMode.personal
                                      ? 'Personal mode'
                                      : 'Multi-user mode',
                                  style: TextStyle(
                                    color:
                                        tokens.onSurface.withValues(alpha: 0.5),
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // ── Profile ──
                    _SettingsTile(
                      icon: Icons.person_outline_rounded,
                      title: 'Profile',
                      subtitle: 'View and edit your profile',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: () => _openSubPage(
                        context,
                        ProfilePage(profileService: ProfileService(client)),
                      ),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),

                    // ── Change password ──
                    _SettingsTile(
                      icon: Icons.lock_reset_rounded,
                      title: 'Change password',
                      subtitle: 'Update your login password',
                      onTap: authService == null
                          ? null
                          : () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => _ChangePasswordPage(
                                    authService: authService!,
                                    visualMode: state.visualMode,
                                  ),
                                ),
                              );
                            },
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),

                    // ── Two-factor authentication ──
                    _SettingsTile(
                      icon: Icons.shield_outlined,
                      title: 'Two-factor authentication',
                      subtitle: 'Manage 2FA for your account',
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: tokens.onSurface.withValues(alpha: 0.3),
                        size: 20,
                      ),
                      onTap: authService == null
                          ? null
                          : () => MfaSetupSheet.show(context, authService!),
                      tokens: tokens,
                      cinematic: cinematic,
                    ),
                    const SizedBox(height: 8),

                    // Sign out options (hidden in personal mode — auto-login handles it)
                    if (state.deploymentMode != DeploymentMode.personal) ...[
                      // ── Multi-account quick switch ──
                      if (authService != null) ...[
                        _SettingsTile(
                          icon: Icons.people_outlined,
                          title: 'Switch account',
                          subtitle: 'Switch between saved accounts',
                          trailing: Icon(
                            Icons.chevron_right_rounded,
                            color: tokens.onSurface.withValues(alpha: 0.3),
                            size: 20,
                          ),
                          onTap: () {
                            final reopen = onReopenSettings;
                            Navigator.of(context).pop();
                            showModalBottomSheet(
                              context: context,
                              isScrollControlled: true,
                              backgroundColor: Colors.transparent,
                              builder: (_) => AccountPickerSheet(
                                auth: authService!,
                                lockService: lockService ?? AppLockService(),
                                visualMode: state.visualMode,
                                onAccountSwitched: (result) {},
                                onAddAccount: () async {
                                  await onLogout();
                                },
                              ),
                            ).then((_) {
                              if (reopen != null) reopen();
                            });
                          },
                          tokens: tokens,
                          cinematic: cinematic,
                        ),
                        const SizedBox(height: 8),
                        _SettingsTile(
                          icon: Icons.bookmark_add_outlined,
                          title: 'Keep me signed in',
                          subtitle: 'Save this account for quick switching',
                          onTap: () async {
                            final pin = await _showSetPinDialog(context, tokens);
                            if (context.mounted) {
                              try {
                                await authService!.linkCurrentAccount(
                                  pin: pin,
                                );
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Account saved${pin != null ? ' with PIN protection' : ''}',
                                      ),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                  Navigator.of(context).pop();
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Failed: $e'),
                                      behavior: SnackBarBehavior.floating,
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                }
                              }
                            }
                          },
                          tokens: tokens,
                          cinematic: cinematic,
                        ),
                        const SizedBox(height: 8),
                      ],
                      _SettingsTile(
                        icon: Icons.logout_rounded,
                        title: 'Sign out',
                        onTap: () async {
                          Navigator.of(context).pop();
                          await onLogout();
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                      const SizedBox(height: 8),
                      _SettingsTile(
                        icon: Icons.devices_rounded,
                        title: 'Sign out all devices',
                        subtitle: 'Ends all active sessions',
                        onTap: () async {
                          Navigator.of(context).pop();
                          await onLogoutAll();
                        },
                        tokens: tokens,
                        cinematic: cinematic,
                        destructive: true,
                      ),
                    ],

                    // ── Developer (debug builds only) ──────────────────────
                    if (kDebugMode) ...[
                      const SizedBox(height: 32),
                      _SectionLabel(text: 'Developer', tokens: tokens),
                      const SizedBox(height: 12),
                      _SettingsTile(
                        icon: Icons.science_rounded,
                        title: 'A/B Test Overrides',
                        subtitle: 'QA: override experiment variant assignments',
                        trailing: Icon(
                          Icons.chevron_right_rounded,
                          color: tokens.onSurface.withValues(alpha: 0.4),
                        ),
                        onTap: () => _openSubPage(
                          context,
                          AbTestOverridePage(
                            service: sl<AbTestService>(),
                            visualMode: state.visualMode,
                          ),
                        ),
                        tokens: tokens,
                        cinematic: cinematic,
                      ),
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

