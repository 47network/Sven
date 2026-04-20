import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'app/desktop_window.dart';
import 'app/performance_tracker.dart';
import 'app/service_locator.dart';
import 'app/sven_user_app.dart';
import 'config/env_config.dart';
import 'features/chat/background_chat_sync_service.dart';
import 'features/notifications/push_notification_manager.dart';
import 'firebase_options.dart';

class _FatalBootstrapApp extends StatelessWidget {
  const _FatalBootstrapApp({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        backgroundColor: const Color(0xFF1A0000),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '⚠ Startup Error',
                  style: TextStyle(
                    color: Colors.redAccent,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  message,
                  style: const TextStyle(color: Colors.white70, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Top-level FCM background message handler.
/// Must be a top-level function (not a method) annotated with vm:entry-point.
///
/// Supports two modes:
/// 1. **Privacy-first**: data-only message with `type: "sven_push"` —
///    fetches the actual content from the Sven server (Google never sees it).
/// 2. **Legacy**: notification payload with `chat_id` — syncs local cache.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase must be initialized before any Firebase calls.
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Privacy-first: data-only wake-up — fetch and display from our server.
  if (message.data['type'] == 'sven_push') {
    await PushNotificationManager.instance.handleBackgroundPrivacyPush();
    return;
  }

  // Legacy: keep local chat cache hot even when the app is terminated/backgrounded.
  final chatId = message.data['chat_id'] as String?;
  await BackgroundChatSyncService.sync(chatId: chatId);
}

Future<void> _initializeFirebaseAndPush() async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    // Re-enable messaging auto-init after launch so token generation and
    // background handlers are available without blocking cold-start.
    await FirebaseMessaging.instance.setAutoInitEnabled(true);
    // Register background message handler once Firebase is ready.
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    await PushNotificationManager.instance.initialize();
  } catch (_) {
    // Keep startup resilient if Firebase/push setup is temporarily unavailable.
  }
}

void main() {
  // Wrap the entire startup in runZonedGuarded to catch absolutely any
  // unhandled error — including async gaps the framework try/catch misses.
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      // In release mode, show a red diagnostic error screen instead of the
      // default grey SizedBox so crashes are visible and diagnosable.
      ErrorWidget.builder = (FlutterErrorDetails details) {
        return MaterialApp(
          home: Scaffold(
            backgroundColor: const Color(0xFF1A0000),
            body: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '⚠ Widget Error',
                      style: TextStyle(
                        color: Colors.redAccent,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      details.exceptionAsString(),
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      (details.stack ?? StackTrace.empty).toString(),
                      style: const TextStyle(
                        color: Colors.white38,
                        fontSize: 10,
                      ),
                      maxLines: 40,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      };

      FlutterError.onError = (FlutterErrorDetails details) {
        FlutterError.presentError(details);
      };

      PerformanceTracker.startFrameMonitoring();

      // Initialise native desktop window before any UI is rendered.
      // No-op on Android, iOS, and web ([isDesktop] == false).
      if (isDesktop) await DesktopWindowManager.instance.initialize();

      // Set up service locator (get_it) — DioHttpClient, AuthService, etc.
      try {
        await setupServiceLocator();
      } catch (error, stackTrace) {
        FlutterError.reportError(
          FlutterErrorDetails(
            exception: error,
            stack: stackTrace,
            library: 'app-bootstrap',
            context: ErrorDescription(
              'while initializing secure startup dependencies',
            ),
          ),
        );
        runApp(
          _FatalBootstrapApp(
            message:
                'Startup failed:\n\n$error\n\n'
                'Stack trace (top):\n${stackTrace.toString().split('\n').take(15).join('\n')}',
          ),
        );
        return;
      }

      final app = ProviderScope(
        child: SentryWidget(child: const SvenUserApp()),
      );

      // When Sentry DSN is empty, skip blocking Sentry init and render
      // immediately.
      final dsn = EnvConfig.sentryDsn.trim();
      if (dsn.isEmpty) {
        runApp(app);
      } else {
        await SentryFlutter.init((options) {
          options.dsn = dsn;
          options.tracesSampleRate = 0.2;
          // ignore: experimental_member_use
          options.profilesSampleRate = 0.1;
          options.attachScreenshot = true;
          options.environment = EnvConfig.sentryEnv;
        }, appRunner: () => runApp(app));
      }

      // Defer non-critical startup work to avoid blocking first frame.
      unawaited(_initializeFirebaseAndPush());
    },
    // This catches ANY unhandled error anywhere in the async zone —
    // including errors thrown during startup that escape try/catch.
    (error, stackTrace) {
      // If we get here, something crashed before or outside the widget tree.
      // Attempt to show a diagnostic screen. If runApp was never called,
      // the binding still exists from ensureInitialized, so this works.
      try {
        runApp(
          _FatalBootstrapApp(
            message:
                'Uncaught zone error:\n\n$error\n\n'
                'Stack trace:\n${stackTrace.toString().split('\n').take(20).join('\n')}',
          ),
        );
      } catch (_) {
        // Last resort: nothing we can do.
      }
    },
  );
}
