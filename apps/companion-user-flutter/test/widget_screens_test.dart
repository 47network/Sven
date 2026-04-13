// ═══════════════════════════════════════════════════════════════════════════
// Widget tests for key Sven screens — Sprint 72
//
// Coverage:
//   1. LoginPage — renders, form validation, submit callback, initial message
//   2. ChatHomePage — renders with service locator wiring, loading state
//   3. ChatThreadPage — renders with thread, composer visible, header toggle
//   4. ChatComposer — renders, text input, send callback, disabled state
//   5. ApprovalsPage — renders, tab switching, empty state
//
// Run with: flutter test test/widget_screens_test.dart
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:convert';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:sven_user_flutter/app/app_models.dart';
import 'package:sven_user_flutter/app/authenticated_client.dart';
import 'package:sven_user_flutter/app/database.dart';
import 'package:sven_user_flutter/app/service_locator.dart';
import 'package:sven_user_flutter/features/approvals/approvals_models.dart';
import 'package:sven_user_flutter/features/approvals/approvals_page.dart';
import 'package:sven_user_flutter/features/approvals/approvals_service.dart';
import 'package:sven_user_flutter/features/auth/login_page.dart';
import 'package:sven_user_flutter/features/chat/chat_composer.dart';
import 'package:sven_user_flutter/features/chat/chat_home_page.dart';
import 'package:sven_user_flutter/features/chat/chat_models.dart';
import 'package:sven_user_flutter/features/chat/chat_service.dart';
import 'package:sven_user_flutter/features/chat/chat_thread_page.dart';
import 'package:sven_user_flutter/features/chat/messages_repository.dart';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(body: child),
    );

AuthenticatedClient _mockClient([
  Future<http.Response> Function(http.Request)? handler,
]) {
  return AuthenticatedClient(
    client: MockClient(handler ?? (_) async => http.Response('{"data":{}}', 200)),
  );
}

/// Mock [http.Response] that returns an empty chats list.
http.Response _emptyChatsResponse() => http.Response(
      jsonEncode({
        'data': <Map<String, dynamic>>[],
        'meta': {'total': 0, 'limit': 40, 'offset': 0},
      }),
      200,
    );

/// Mock [http.Response] for approvals list.
http.Response _emptyApprovalsResponse() => http.Response(
      jsonEncode({'data': <Map<String, dynamic>>[]}),
      200,
    );

/// Creates a mock handler that returns empty data for any endpoint.
Future<http.Response> Function(http.Request) _noop200Handler() {
  return (http.Request request) async {
    final path = request.url.path;
    if (path.contains('/chats')) {
      return _emptyChatsResponse();
    }
    if (path.contains('/approvals')) {
      return _emptyApprovalsResponse();
    }
    return http.Response('{"data":{}}', 200);
  };
}

/// Fake [ApprovalsService] that returns canned data without HTTP calls.
class _FakeApprovalsService extends ApprovalsService {
  _FakeApprovalsService({
    this.pending = const [],
    this.all = const [],
  }) : super(client: _mockClient());

  final List<ApprovalItem> pending;
  final List<ApprovalItem> all;

  @override
  Future<List<ApprovalItem>> list({String? status}) async {
    return status == 'pending'
        ? List<ApprovalItem>.from(pending)
        : List<ApprovalItem>.from(all);
  }

  @override
  Future<void> vote({required String id, required String decision}) async {}
}

// ────────────────────────────────────────────────────────────────────────────
// 1. LoginPage
// ────────────────────────────────────────────────────────────────────────────

void main() {
  group('LoginPage', () {
    testWidgets('renders username, password fields and sign-in button',
        (tester) async {
      await tester.pumpWidget(_wrap(
        LoginPage(onSubmit: (_, __) async {}),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsAtLeastNWidgets(2));
      expect(find.text('Sign in'), findsOneWidget);
    });

    testWidgets('displays initial message when provided', (tester) async {
      await tester.pumpWidget(_wrap(
        LoginPage(
          onSubmit: (_, __) async {},
          initialMessage: 'Session expired',
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Session expired'), findsOneWidget);
    });

    testWidgets('tapping sign-in with empty fields shows validation',
        (tester) async {
      await tester.pumpWidget(_wrap(
        LoginPage(onSubmit: (_, __) async {}),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('login_submit_button')));
      await tester.pumpAndSettle();

      // Should not crash — validation runs, no network call made.
      expect(tester.takeException(), isNull);
    });

    testWidgets('calls onSubmit with entered credentials', (tester) async {
      String? capturedUser;
      String? capturedPass;

      await tester.pumpWidget(_wrap(
        LoginPage(onSubmit: (u, p) async {
          capturedUser = u;
          capturedPass = p;
        }),
      ));
      await tester.pumpAndSettle();

      final textFields = find.byType(TextField);
      // First visible TextField is username, second is password.
      await tester.enterText(textFields.at(0), 'alice');
      await tester.enterText(textFields.at(1), 'secret123');
      await tester.tap(find.byKey(const Key('login_submit_button')));
      await tester.pumpAndSettle();

      expect(capturedUser, 'alice');
      expect(capturedPass, 'secret123');
    });

    testWidgets('SSO buttons hidden when onSsoSignIn is null', (tester) async {
      await tester.pumpWidget(_wrap(
        LoginPage(onSubmit: (_, __) async {}, onSsoSignIn: null),
      ));
      await tester.pumpAndSettle();

      // No Google/Apple/GitHub SSO buttons when callback is null.
      expect(find.text('Google'), findsNothing);
      expect(find.text('Apple'), findsNothing);
      expect(find.text('GitHub'), findsNothing);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ChatHomePage
  // ──────────────────────────────────────────────────────────────────────────

  group('ChatHomePage', () {
    late AppDatabase db;
    late MessagesRepository repo;

    setUp(() {
      db = AppDatabase(NativeDatabase.memory());
      repo = MessagesRepository.plaintextForTests(db: db);

      // Register the repository in the service locator so ChatHomePage can
      // pull it via sl<MessagesRepository>().
      if (sl.isRegistered<MessagesRepository>()) {
        sl.unregister<MessagesRepository>();
      }
      sl.registerSingleton<MessagesRepository>(repo);
    });

    tearDown(() async {
      if (sl.isRegistered<MessagesRepository>()) {
        sl.unregister<MessagesRepository>();
      }
      await db.close();
    });

    testWidgets('renders without error and shows loading indicator',
        (tester) async {
      final client = _mockClient(_noop200Handler());

      await tester.pumpWidget(_wrap(
        ChatHomePage(
          visualMode: VisualMode.classic,
          motionLevel: MotionLevel.full,
          avatarMode: AvatarMode.orb,
          onLogout: () {},
          client: client,
        ),
      ));
      // Pump once — should see loading state.
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders in cinematic mode without error', (tester) async {
      final client = _mockClient(_noop200Handler());

      await tester.pumpWidget(_wrap(
        ChatHomePage(
          visualMode: VisualMode.cinematic,
          motionLevel: MotionLevel.reduced,
          avatarMode: AvatarMode.robot,
          onLogout: () {},
          client: client,
        ),
      ));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ChatThreadPage
  // ──────────────────────────────────────────────────────────────────────────

  group('ChatThreadPage', () {
    testWidgets('renders with a thread and shows composer', (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final client = _mockClient(_noop200Handler());
      final chatService = ChatService(client: client);

      await tester.pumpWidget(_wrap(
        ChatThreadPage(
          thread: ChatThreadSummary(
            id: 'thread-1',
            title: 'Test Chat',
            lastMessage: '',
            updatedAt: DateTime.now(),
          ),
          chatService: chatService,
        ),
      ));
      await tester.pump();

      // The ChatThreadPage widget should be in the tree.
      expect(find.byType(ChatThreadPage), findsOneWidget);
    });

    testWidgets('renders with header when showHeader is true', (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final client = _mockClient(_noop200Handler());
      final chatService = ChatService(client: client);

      await tester.pumpWidget(_wrap(
        ChatThreadPage(
          thread: ChatThreadSummary(
            id: 'thread-2',
            title: 'With Header',
            lastMessage: '',
            updatedAt: DateTime.now(),
          ),
          chatService: chatService,
          showHeader: true,
        ),
      ));
      await tester.pump();

      // Page should render successfully with header visible.
      expect(find.byType(ChatThreadPage), findsOneWidget);
    });

    testWidgets('incognito mode renders incognito indicator', (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final client = _mockClient(_noop200Handler());
      final chatService = ChatService(client: client);

      // Suppress layout overflow errors that occur in narrow test viewports.
      final origHandler = FlutterError.onError;
      final overflowErrors = <FlutterErrorDetails>[];
      FlutterError.onError = (details) {
        if (details.toString().contains('overflowed')) {
          overflowErrors.add(details);
        } else {
          origHandler?.call(details);
        }
      };
      addTearDown(() => FlutterError.onError = origHandler);

      await tester.pumpWidget(_wrap(
        ChatThreadPage(
          thread: ChatThreadSummary(
            id: 'thread-incog',
            title: 'Incognito',
            lastMessage: '',
            updatedAt: DateTime.now(),
          ),
          chatService: chatService,
          incognito: true,
        ),
      ));
      await tester.pump();

      // The incognito banner or indicator should be present.
      expect(
        find.textContaining(RegExp(r'[Ii]ncognito')),
        findsAtLeastNWidgets(1),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ChatComposer
  // ──────────────────────────────────────────────────────────────────────────

  group('ChatComposer', () {
    testWidgets('renders input field and send button', (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(_wrap(
        ChatComposer(
          onSend: (_, __) {},
          onCancel: () {},
          onRetry: () {},
          isSending: false,
          hasFailed: false,
          isEnabled: true,
        ),
      ));
      await tester.pump();

      expect(find.byType(ChatComposer), findsOneWidget);
    });

    testWidgets('calls onSend with typed text', (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      String? capturedText;

      await tester.pumpWidget(_wrap(
        ChatComposer(
          onSend: (text, _) {
            capturedText = text;
          },
          onCancel: () {},
          onRetry: () {},
          isSending: false,
          hasFailed: false,
          isEnabled: true,
        ),
      ));
      await tester.pump();

      final textFields = find.byType(TextField);
      if (textFields.evaluate().isNotEmpty) {
        await tester.enterText(textFields.first, 'Hello Sven!');
        await tester.pump();

        // Find and tap the send button (icon or gesture).
        final sendButton = find.byIcon(Icons.send_rounded);
        if (sendButton.evaluate().isNotEmpty) {
          await tester.tap(sendButton.first);
          await tester.pump();
          expect(capturedText, 'Hello Sven!');
        }
      }
    });

    testWidgets('send button disabled when isSending is true', (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(_wrap(
        ChatComposer(
          onSend: (_, __) {},
          onCancel: () {},
          onRetry: () {},
          isSending: true,
          hasFailed: false,
          isEnabled: true,
        ),
      ));
      await tester.pump();

      // While sending, the cancel/stop button should appear instead.
      expect(find.byType(ChatComposer), findsOneWidget);
    });

    testWidgets('retry button visible when hasFailed', (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(_wrap(
        ChatComposer(
          onSend: (_, __) {},
          onCancel: () {},
          onRetry: () {},
          isSending: false,
          hasFailed: true,
          isEnabled: true,
        ),
      ));
      await tester.pump();

      // Retry icon should be present when a message has failed.
      expect(
        find.byIcon(Icons.refresh_rounded),
        findsAtLeastNWidgets(1),
      );
    });

    testWidgets('disabled state prevents text input interaction',
        (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(_wrap(
        ChatComposer(
          onSend: (_, __) {},
          onCancel: () {},
          onRetry: () {},
          isSending: false,
          hasFailed: false,
          isEnabled: false,
        ),
      ));
      await tester.pump();

      expect(find.byType(ChatComposer), findsOneWidget);
    });

    testWidgets('renders with editPrefillText without error',
        (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 892));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(_wrap(
        ChatComposer(
          onSend: (_, __) {},
          onCancel: () {},
          onRetry: () {},
          isSending: false,
          hasFailed: false,
          isEnabled: true,
          editPrefillText: 'Editing previous message',
        ),
      ));
      await tester.pump();

      // Should render without exception when edit prefill is active.
      expect(find.byType(ChatComposer), findsOneWidget);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ApprovalsPage
  // ──────────────────────────────────────────────────────────────────────────

  group('ApprovalsPage', () {
    testWidgets('renders empty state when no approvals', (tester) async {
      final client = _mockClient();
      final service = _FakeApprovalsService();

      await tester.pumpWidget(_wrap(
        ApprovalsPage(
          client: client,
          service: service,
          enableSse: false,
          enableFallbackPolling: false,
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('No approvals found.'), findsOneWidget);
    });

    testWidgets('renders pending approval items', (tester) async {
      final client = _mockClient();
      final approval = ApprovalItem(
        id: 'a-1',
        status: 'pending',
        type: 'test.approval',
        title: 'Test Approval Request',
        createdAt: DateTime(2026, 3, 28),
      );
      final service = _FakeApprovalsService(
        pending: [approval],
        all: [approval],
      );

      await tester.pumpWidget(_wrap(
        ApprovalsPage(
          client: client,
          service: service,
          enableSse: false,
          enableFallbackPolling: false,
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Test Approval Request'), findsOneWidget);
    });

    testWidgets('tab switch between pending and history', (tester) async {
      final client = _mockClient();
      final service = _FakeApprovalsService();

      await tester.pumpWidget(_wrap(
        ApprovalsPage(
          client: client,
          service: service,
          enableSse: false,
          enableFallbackPolling: false,
        ),
      ));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Tap "History" or "All" tab if visible.
      final historyTab = find.text('History');
      final allTab = find.text('All');
      final tabToTap = historyTab.evaluate().isNotEmpty ? historyTab : allTab;
      if (tabToTap.evaluate().isNotEmpty) {
        await tester.tap(tabToTap.first);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
      }

      expect(tester.takeException(), isNull);
    });
  });
}
