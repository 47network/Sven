import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sven_user_flutter/app/api_base_service.dart';
import 'package:sven_user_flutter/features/auth/auth_errors.dart';
import 'package:sven_user_flutter/features/auth/auth_service.dart';
import 'package:sven_user_flutter/features/auth/sso_service.dart';
import 'package:sven_user_flutter/features/auth/token_store.dart';

// ── In-memory token store for tests ──────────────────────────────────────────

class _InMemoryTokenStore extends TokenStore {
  _InMemoryTokenStore() : super();
  final _store = <String, String?>{};
  static const _accessKey = 'sven.auth.access_token';
  static const _refreshKey = 'sven.auth.refresh_token';
  static const _userIdKey = 'sven.auth.user_id';
  static const _usernameKey = 'sven.auth.username';
  static const _autoLoginUserKey = 'sven.auth.auto_login_user';
  static const _autoLoginPassKey = 'sven.auth.auto_login_pass';

  @override
  Future<String?> readAccessToken() async => _store[_accessKey];
  @override
  Future<String?> readRefreshToken() async => _store[_refreshKey];
  @override
  Future<void> writeAccessToken(String token) async =>
      _store[_accessKey] = token;
  @override
  Future<void> writeRefreshToken(String token) async =>
      _store[_refreshKey] = token;
  @override
  Future<String?> readUserId() async => _store[_userIdKey];
  @override
  Future<void> writeUserId(String userId) async =>
      _store[_userIdKey] = userId;
  @override
  Future<String?> readUsername() async => _store[_usernameKey];
  @override
  Future<void> writeUsername(String username) async =>
      _store[_usernameKey] = username;
  @override
  Future<void> writeAutoLogin(String username, String password) async {
    _store[_autoLoginUserKey] = username;
    _store[_autoLoginPassKey] = password;
  }

  @override
  Future<({String username, String password})?> readAutoLogin() async {
    final user = _store[_autoLoginUserKey];
    final pass = _store[_autoLoginPassKey];
    if (user != null &&
        user.isNotEmpty &&
        pass != null &&
        pass.isNotEmpty) {
      return (username: user, password: pass);
    }
    return null;
  }

  @override
  Future<void> clearAutoLogin() async {
    _store.remove(_autoLoginUserKey);
    _store.remove(_autoLoginPassKey);
  }

  @override
  Future<void> clear() async {
    _store.remove(_accessKey);
    _store.remove(_refreshKey);
    _store.remove(_userIdKey);
    _store.remove(_usernameKey);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

http.Response _json(int statusCode, Map<String, dynamic> body) =>
    http.Response(jsonEncode(body), statusCode,
        headers: {'content-type': 'application/json'});

void main() {
  late _InMemoryTokenStore store;

  setUp(() async {
    SharedPreferences.setMockInitialValues({'sven.api_base': 'https://test.api'});
    await ApiBaseService.load();
    store = _InMemoryTokenStore();
  });

  AuthService buildService(MockClient client) =>
      AuthService(client: client, store: store);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Login
  // ═══════════════════════════════════════════════════════════════════════════

  group('login', () {
    test('happy path stores tokens and returns LoginResult', () async {
      final client = MockClient((_) async => _json(200, {
            'data': {
              'accessToken': 'tok',
              'refresh_token': 'ref',
              'user_id': 'u1',
              'username': 'alice',
            }
          }));
      final svc = buildService(client);

      final result =
          await svc.login(username: 'alice', password: 'secret');

      expect(result.token, 'tok');
      expect(result.userId, 'u1');
      expect(result.username, 'alice');
      expect(result.mfaRequired, isFalse);
      expect(await store.readAccessToken(), 'tok');
      expect(await store.readRefreshToken(), 'ref');
      expect(await store.readUserId(), 'u1');
    });

    test('MFA required returns partial result with mfaToken', () async {
      final client = MockClient((_) async => _json(200, {
            'data': {
              'requires_totp': true,
              'pre_session_id': 'mfa-token-1',
            }
          }));
      final svc = buildService(client);

      final result =
          await svc.login(username: 'bob', password: 'pass');

      expect(result.mfaRequired, isTrue);
      expect(result.mfaToken, 'mfa-token-1');
      expect(result.token, isEmpty);
      expect(result.userId, isEmpty);
    });

    test('401 throws invalidCredentials', () async {
      final client =
          MockClient((_) async => _json(401, {'error': 'nope'}));
      final svc = buildService(client);

      expect(
        () => svc.login(username: 'x', password: 'y'),
        throwsA(isA<AuthException>().having(
            (e) => e.failure, 'failure', AuthFailure.invalidCredentials)),
      );
    });

    test('403 throws accountLocked', () async {
      final client =
          MockClient((_) async => _json(403, {'error': 'locked'}));
      final svc = buildService(client);

      expect(
        () => svc.login(username: 'x', password: 'y'),
        throwsA(isA<AuthException>().having(
            (e) => e.failure, 'failure', AuthFailure.accountLocked)),
      );
    });

    test('429 throws rateLimited', () async {
      final client =
          MockClient((_) async => _json(429, {'error': 'slow down'}));
      final svc = buildService(client);

      expect(
        () => svc.login(username: 'x', password: 'y'),
        throwsA(isA<AuthException>().having(
            (e) => e.failure, 'failure', AuthFailure.rateLimited)),
      );
    });

    test('500 throws server error', () async {
      final client =
          MockClient((_) async => _json(500, {'error': 'boom'}));
      final svc = buildService(client);

      expect(
        () => svc.login(username: 'x', password: 'y'),
        throwsA(isA<AuthException>()
            .having((e) => e.failure, 'failure', AuthFailure.server)),
      );
    });

    test('malformed JSON body throws server error', () async {
      final client = MockClient(
          (_) async => http.Response('not json', 200));
      final svc = buildService(client);

      expect(
        () => svc.login(username: 'x', password: 'y'),
        throwsA(anything),
      );
    });

    test('missing token in 200 response throws server error', () async {
      final client = MockClient((_) async => _json(200, {
            'data': {'user_id': 'u1'}
          }));
      final svc = buildService(client);

      expect(
        () => svc.login(username: 'x', password: 'y'),
        throwsA(isA<AuthException>()
            .having((e) => e.failure, 'failure', AuthFailure.server)),
      );
    });

    test('missing user_id in 200 response throws server error', () async {
      final client = MockClient((_) async => _json(200, {
            'data': {'accessToken': 'tok'}
          }));
      final svc = buildService(client);

      expect(
        () => svc.login(username: 'x', password: 'y'),
        throwsA(isA<AuthException>()
            .having((e) => e.failure, 'failure', AuthFailure.server)),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Token refresh
  // ═══════════════════════════════════════════════════════════════════════════

  group('refresh', () {
    test('success returns new access token and updates store', () async {
      await store.writeRefreshToken('old-ref');
      final client = MockClient((_) async => _json(200, {
            'data': {
              'accessToken': 'new-tok',
              'refresh_token': 'new-ref',
            }
          }));
      final svc = buildService(client);

      final token = await svc.refresh();

      expect(token, 'new-tok');
      expect(await store.readAccessToken(), 'new-tok');
      expect(await store.readRefreshToken(), 'new-ref');
    });

    test('401 throws sessionExpired', () async {
      await store.writeRefreshToken('expired-ref');
      final client =
          MockClient((_) async => _json(401, {'error': 'expired'}));
      final svc = buildService(client);

      expect(
        () => svc.refresh(),
        throwsA(isA<AuthException>().having(
            (e) => e.failure, 'failure', AuthFailure.sessionExpired)),
      );
    });

    test('no stored refresh token throws sessionExpired', () async {
      final client = MockClient((_) async => _json(200, {}));
      final svc = buildService(client);

      expect(
        () => svc.refresh(),
        throwsA(isA<AuthException>().having(
            (e) => e.failure, 'failure', AuthFailure.sessionExpired)),
      );
    });

    test('concurrent calls share the same future (deduplication)', () async {
      var callCount = 0;
      await store.writeRefreshToken('ref');
      final client = MockClient((_) async {
        callCount++;
        return _json(200, {
          'data': {'accessToken': 'dedup-tok', 'refresh_token': 'dedup-ref'}
        });
      });
      final svc = buildService(client);

      final results = await Future.wait([svc.refresh(), svc.refresh()]);

      expect(results[0], 'dedup-tok');
      expect(results[1], 'dedup-tok');
      expect(callCount, 1, reason: 'should only issue one HTTP request');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Logout
  // ═══════════════════════════════════════════════════════════════════════════

  group('logout', () {
    test('success path clears tokens', () async {
      await store.writeAccessToken('tok');
      await store.writeRefreshToken('ref');
      final client = MockClient((_) async => _json(200, {}));
      final svc = buildService(client);

      await svc.logout();

      expect(await store.readAccessToken(), isNull);
      expect(await store.readRefreshToken(), isNull);
    });

    test('clears tokens even when server returns error', () async {
      await store.writeAccessToken('tok');
      await store.writeRefreshToken('ref');
      final client =
          MockClient((_) async => _json(500, {'error': 'oops'}));
      final svc = buildService(client);

      // logout rethrows, but tokens should still be cleared
      try {
        await svc.logout();
      } on AuthException catch (_) {
        // expected
      }

      expect(await store.readAccessToken(), isNull);
      expect(await store.readRefreshToken(), isNull);
    });

    test('does nothing when not authenticated', () async {
      var called = false;
      final client = MockClient((_) async {
        called = true;
        return _json(200, {});
      });
      final svc = buildService(client);

      await svc.logout();

      expect(called, isFalse);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Change password
  // ═══════════════════════════════════════════════════════════════════════════

  group('changePassword', () {
    test('returns null on 200 success', () async {
      await store.writeAccessToken('tok');
      final client = MockClient((_) async => _json(200, {}));
      final svc = buildService(client);

      final result = await svc.changePassword(
          currentPassword: 'old', newPassword: 'new');

      expect(result, isNull);
    });

    test('returns null on 204 success', () async {
      await store.writeAccessToken('tok');
      final client =
          MockClient((_) async => http.Response('', 204));
      final svc = buildService(client);

      final result = await svc.changePassword(
          currentPassword: 'old', newPassword: 'new');

      expect(result, isNull);
    });

    test('returns "Not authenticated" when no token', () async {
      final client = MockClient((_) async => _json(200, {}));
      final svc = buildService(client);

      final result = await svc.changePassword(
          currentPassword: 'old', newPassword: 'new');

      expect(result, 'Not authenticated');
    });

    test('returns server error message on failure', () async {
      await store.writeAccessToken('tok');
      final client = MockClient((_) async => _json(400, {
            'error': {'message': 'Password too weak'}
          }));
      final svc = buildService(client);

      final result = await svc.changePassword(
          currentPassword: 'old', newPassword: 'weak');

      expect(result, 'Password too weak');
    });

    test('returns generic message when error body has no message', () async {
      await store.writeAccessToken('tok');
      final client = MockClient((_) async => _json(422, {}));
      final svc = buildService(client);

      final result = await svc.changePassword(
          currentPassword: 'old', newPassword: 'new');

      expect(result, contains('422'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. MFA verify
  // ═══════════════════════════════════════════════════════════════════════════

  group('verifyMfa', () {
    test('success via /totp/verify stores tokens', () async {
      final client = MockClient((req) async {
        expect(req.url.path, '/v1/auth/totp/verify');
        return _json(200, {
          'data': {
            'accessToken': 'mfa-tok',
            'refresh_token': 'mfa-ref',
            'user_id': 'u1',
            'username': 'alice',
          }
        });
      });
      final svc = buildService(client);

      final result =
          await svc.verifyMfa(mfaToken: 'pre-sess', code: '123456');

      expect(result.token, 'mfa-tok');
      expect(result.userId, 'u1');
      expect(await store.readAccessToken(), 'mfa-tok');
    });

    test('fallback to /mfa/verify on 404', () async {
      var callIndex = 0;
      final client = MockClient((req) async {
        callIndex++;
        if (req.url.path == '/v1/auth/totp/verify') {
          return _json(404, {'error': 'not found'});
        }
        expect(req.url.path, '/v1/auth/mfa/verify');
        return _json(200, {
          'data': {
            'accessToken': 'fallback-tok',
            'refresh_token': 'fallback-ref',
            'user_id': 'u2',
            'username': 'bob',
          }
        });
      });
      final svc = buildService(client);

      final result =
          await svc.verifyMfa(mfaToken: 'pre-sess', code: '654321');

      expect(result.token, 'fallback-tok');
      expect(callIndex, 2, reason: 'should have called both endpoints');
    });

    test('invalid code throws mfaInvalidCode', () async {
      final client =
          MockClient((_) async => _json(401, {'error': 'bad code'}));
      final svc = buildService(client);

      expect(
        () => svc.verifyMfa(mfaToken: 'pre', code: '000000'),
        throwsA(isA<AuthException>().having(
            (e) => e.failure, 'failure', AuthFailure.mfaInvalidCode)),
      );
    });

    test('400 also throws mfaInvalidCode', () async {
      final client =
          MockClient((_) async => _json(400, {'error': 'bad code'}));
      final svc = buildService(client);

      expect(
        () => svc.verifyMfa(mfaToken: 'pre', code: '000000'),
        throwsA(isA<AuthException>().having(
            (e) => e.failure, 'failure', AuthFailure.mfaInvalidCode)),
      );
    });

    test('uses mfaToken as fallback when tokens missing from response',
        () async {
      final client = MockClient((_) async => _json(200, {
            'data': {
              'user_id': 'u3',
              'username': 'charlie',
            }
          }));
      final svc = buildService(client);

      final result =
          await svc.verifyMfa(mfaToken: 'pre-sess-id', code: '111111');

      expect(result.token, 'pre-sess-id');
      expect(result.userId, 'u3');
      expect(await store.readAccessToken(), 'pre-sess-id');
      expect(await store.readRefreshToken(), 'pre-sess-id');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SSO login
  // ═══════════════════════════════════════════════════════════════════════════

  group('loginWithSso', () {
    const credential = SsoCredential(
      provider: 'google',
      idToken: 'google-id-token',
      accessToken: 'google-access',
    );

    test('success stores tokens and returns LoginResult', () async {
      final client = MockClient((req) async {
        expect(req.url.path, '/v1/auth/sso');
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['provider'], 'google');
        expect(body['id_token'], 'google-id-token');
        return _json(200, {
          'data': {
            'accessToken': 'sso-tok',
            'refresh_token': 'sso-ref',
            'user_id': 'sso-u1',
            'username': 'googleuser',
          }
        });
      });
      final svc = buildService(client);

      final result = await svc.loginWithSso(credential);

      expect(result.token, 'sso-tok');
      expect(result.userId, 'sso-u1');
      expect(result.username, 'googleuser');
      expect(await store.readAccessToken(), 'sso-tok');
      expect(await store.readRefreshToken(), 'sso-ref');
    });

    test('401 throws invalidCredentials', () async {
      final client =
          MockClient((_) async => _json(401, {'error': 'bad token'}));
      final svc = buildService(client);

      expect(
        () => svc.loginWithSso(credential),
        throwsA(isA<AuthException>().having(
            (e) => e.failure, 'failure', AuthFailure.invalidCredentials)),
      );
    });

    test('500 throws server error', () async {
      final client =
          MockClient((_) async => _json(500, {'error': 'down'}));
      final svc = buildService(client);

      expect(
        () => svc.loginWithSso(credential),
        throwsA(isA<AuthException>()
            .having((e) => e.failure, 'failure', AuthFailure.server)),
      );
    });

    test('missing token in response throws server error', () async {
      final client = MockClient((_) async => _json(200, {
            'data': {'user_id': 'u1'}
          }));
      final svc = buildService(client);

      expect(
        () => svc.loginWithSso(credential),
        throwsA(isA<AuthException>()
            .having((e) => e.failure, 'failure', AuthFailure.server)),
      );
    });

    test('sends nonce when present in credential', () async {
      final credWithNonce = SsoCredential(
        provider: 'apple',
        idToken: 'apple-id-token',
        nonce: 'test-nonce',
      );
      final client = MockClient((req) async {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        expect(body['nonce'], 'test-nonce');
        expect(body['provider'], 'apple');
        return _json(200, {
          'data': {
            'accessToken': 'apple-tok',
            'refresh_token': 'apple-ref',
            'user_id': 'apple-u1',
            'username': 'appleuser',
          }
        });
      });
      final svc = buildService(client);

      final result = await svc.loginWithSso(credWithNonce);
      expect(result.token, 'apple-tok');
    });
  });
}
