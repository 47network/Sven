/// Named route paths for the entire application.
///
/// All navigation in Sven funnels through these constants so that path strings
/// are never duplicated across files.  The [GoRouter] instance lives in
/// [_SvenUserAppState._buildRouter] where it has closure access to the
/// services instantiated there.
///
/// Deep-link URL scheme:  sven://
///   sven://approvals          → [homeApprovals]
///   sven://chat/<id>          → [homeChat]
library;

// ── Top-level paths ──────────────────────────────────────────────────────────

/// First-time deployment / admin setup.
const appRouteSetup = '/setup';

/// First-run onboarding wizard.
const appRouteOnboarding = '/onboarding';

/// Login screen.
const appRouteLogin = '/login';

/// MFA / 2FA verification screen — shown after password login when the
/// account has two-factor authentication enabled.
const appRouteMfa = '/mfa';

/// Authenticated shell — all post-login content lives here.
const appRouteHome = '/home';

// ── Sub-paths under /home ────────────────────────────────────────────────────

/// Approvals list (reachable via deep link: sven://approvals).
const appRouteHomeApprovals = '/home/approvals';

/// Brain visualization (knowledge graph map).
const appRouteHomeBrain = '/home/brain';

/// On-device inference (local AI model management).
const appRouteHomeInference = '/home/inference';

/// Chat thread deep-link helper.  Pass the thread id to get a pushable path.
///
/// Example:
/// ```dart
/// _router.push(appRouteHomeChat('abc123'));
/// ```
String appRouteHomeChat(String chatId) => '/home/chat/$chatId';

/// Voice/video call screen. Pass the chat id and call type.
///
/// Example:
/// ```dart
/// _router.push(appRouteCall('abc123', type: 'video'));
/// ```
String appRouteCall(String chatId, {String type = 'voice'}) =>
    '/home/call/$chatId?type=$type';

/// Global search page.
const appRouteHomeSearch = '/home/search';

/// Media gallery for a chat.
String appRouteMediaGallery(String chatId) => '/home/media/$chatId';

// ── AI Hub sub-paths ─────────────────────────────────────────────────────

/// Unified AI capabilities hub.
const appRouteHomeAiHub = '/home/ai';

/// Image analysis pipeline.
const appRouteHomeAiImage = '/home/ai/image';

/// Audio scribe (on-device STT).
const appRouteHomeAiScribe = '/home/ai/scribe';

/// AI-powered device actions.
const appRouteHomeAiActions = '/home/ai/actions';

/// Smart routing configuration.
const appRouteHomeAiRouting = '/home/ai/routing';

/// AI module catalog & management.
const appRouteHomeAiModules = '/home/ai/modules';

/// Privacy controls & isolation dashboard.
const appRouteHomeAiPrivacy = '/home/ai/privacy';

/// Brain admin (quantum fading, emotional intel, reasoning, GDPR).
const appRouteHomeAiBrainAdmin = '/home/ai/brain-admin';

/// Community agents (personas, moderation, changelog, corrections).
const appRouteHomeAiCommunityAgents = '/home/ai/community-agents';

/// Calibrated intelligence (confidence, feedback, corrections, snapshots).
const appRouteHomeAiCalibration = '/home/ai/calibration';

/// Federation (identity, peers, homeserver, consent, sovereignty, health).
const appRouteHomeAiFederation = '/home/ai/federation';

/// User profile page.
const appRouteHomeProfile = '/home/profile';

/// Notification preferences page.
const appRouteHomeNotificationPrefs = '/home/notification-preferences';
