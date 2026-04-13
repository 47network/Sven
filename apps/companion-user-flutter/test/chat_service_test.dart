import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sven_user_flutter/app/api_base_service.dart';
import 'package:sven_user_flutter/app/authenticated_client.dart';
import 'package:sven_user_flutter/features/auth/token_store.dart';
import 'package:sven_user_flutter/features/chat/chat_service.dart';

// ── In-memory token store for tests ──────────────────────────────────────────

class _InMemoryTokenStore extends TokenStore {
  _InMemoryTokenStore() : super();
  final _store = <String, String?>{};
  static const _accessKey = 'sven.auth.access_token';
  static const _refreshKey = 'sven.auth.refresh_token';
  static const _userIdKey = 'sven.auth.user_id';
  static const _usernameKey = 'sven.auth.username';

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
  Future<void> writeAutoLogin(String u, String p) async {}
  @override
  Future<({String username, String password})?> readAutoLogin() async => null;
  @override
  Future<void> clearAutoLogin() async {}
  @override
  Future<void> clear() async {
    _store.remove(_accessKey);
    _store.remove(_refreshKey);
    _store.remove(_userIdKey);
    _store.remove(_usernameKey);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const _api = 'https://test.api';

http.Response _json(Object body, {int status = 200}) => http.Response(
      jsonEncode(body),
      status,
      headers: {'content-type': 'application/json'},
    );

/// Thread JSON payload matching [ChatThreadSummary.fromJson].
Map<String, dynamic> _thread(String id, {String? name, String? updatedAt}) => {
      'id': id,
      'name': name ?? 'Chat $id',
      'last_message_at': updatedAt ?? '2025-01-01T00:00:00Z',
    };

/// Message JSON matching generated [ChatMessage.fromJson].
Map<String, dynamic> _message(String id,
        {String role = 'assistant', String text = 'Hello'}) =>
    {
      'id': id,
      'role': role,
      'text': text,
      'created_at': '2025-01-01T00:00:00.000Z',
    };

ChatService _svc(http.Client client) {
  final store = _InMemoryTokenStore();
  store.writeAccessToken('test-token');
  final authClient = AuthenticatedClient(client: client, tokenStore: store);
  return ChatService(client: authClient);
}

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({'sven.api_base': _api});
    await ApiBaseService.load();
  });

  // ── listChats ─────────────────────────────────────────────────────────────

  group('listChats', () {
    test('parses threads from data.rows', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {
              'rows': [_thread('t1'), _thread('t2')],
              'has_more': true,
            }
          })));

      final page = await svc.listChats();
      expect(page.threads, hasLength(2));
      expect(page.threads.first.id, 't1');
      expect(page.threads.last.id, 't2');
      expect(page.hasMore, isTrue);
    });

    test('sends limit and offset params', () async {
      Uri? captured;
      final svc = _svc(MockClient((req) async {
        captured = req.url;
        return _json({
          'data': {'rows': [], 'has_more': false}
        });
      }));

      await svc.listChats(limit: 10, offset: 5);
      expect(captured!.queryParameters['limit'], '10');
      expect(captured!.queryParameters['offset'], '5');
    });

    test('returns empty page when data.rows is null', () async {
      final svc = _svc(MockClient((_) async => _json({'data': {}})));

      final page = await svc.listChats();
      expect(page.threads, isEmpty);
      expect(page.hasMore, isFalse);
    });

    test('throws ChatServiceException on non-200', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 403)));

      expect(
        () => svc.listChats(),
        throwsA(isA<ChatServiceException>()),
      );
    });

    test('throws on retriable status codes', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 503)));

      expect(
        () => svc.listChats(),
        throwsA(isA<ChatServiceException>().having(
          (e) => e.message,
          'message',
          contains('retrying'),
        )),
      );
    });
  });

  // ── listMessages ──────────────────────────────────────────────────────────

  group('listMessages', () {
    test('parses messages from data.rows', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {
              'rows': [_message('m1'), _message('m2', role: 'user')],
              'has_more': false,
            }
          })));

      final page = await svc.listMessages('chat1');
      expect(page.messages, hasLength(2));
      expect(page.messages.first.id, 'm1');
      expect(page.messages.first.role, 'assistant');
      expect(page.messages.last.role, 'user');
      expect(page.hasMore, isFalse);
    });

    test('sends chatId, limit, and before params', () async {
      Uri? captured;
      final svc = _svc(MockClient((req) async {
        captured = req.url;
        return _json({
          'data': {'rows': [], 'has_more': false}
        });
      }));

      await svc.listMessages('c42', before: 'cursor-abc', limit: 20);
      expect(captured!.path, endsWith('/v1/chats/c42/messages'));
      expect(captured!.queryParameters['limit'], '20');
      expect(captured!.queryParameters['before'], 'cursor-abc');
    });

    test('throws on non-200', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 500)));

      expect(
        () => svc.listMessages('c1'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── listMessageFeedback ───────────────────────────────────────────────────

  group('listMessageFeedback', () {
    test('returns map of message_id to feedback', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {
              'rows': [
                {'message_id': 'm1', 'feedback': 'up'},
                {'message_id': 'm2', 'feedback': 'down'},
                {'message_id': 'm3', 'feedback': 'neutral'}, // filtered out
              ]
            }
          })));

      final fb = await svc.listMessageFeedback('c1');
      expect(fb, {'m1': 'up', 'm2': 'down'});
    });

    test('skips rows with missing message_id', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {
              'rows': [
                {'feedback': 'up'},
                {'message_id': '', 'feedback': 'up'},
              ]
            }
          })));

      final fb = await svc.listMessageFeedback('c1');
      expect(fb, isEmpty);
    });

    test('throws on non-200', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 403)));

      expect(
        () => svc.listMessageFeedback('c1'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── setMessageFeedback ────────────────────────────────────────────────────

  group('setMessageFeedback', () {
    test('sends PUT with feedback body', () async {
      String? body;
      final svc = _svc(MockClient((req) async {
        body = req.body;
        return _json({'ok': true});
      }));

      await svc.setMessageFeedback('c1', 'm1', feedback: 'up');
      final parsed = jsonDecode(body!) as Map<String, dynamic>;
      expect(parsed['feedback'], 'up');
    });

    test('throws on non-200', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 500)));

      expect(
        () => svc.setMessageFeedback('c1', 'm1', feedback: 'down'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  group('sendMessage', () {
    test('sends text and returns parsed message', () async {
      final svc = _svc(MockClient((req) async {
        return _json({
          'data': _message('m-resp', role: 'assistant', text: 'Reply'),
        }, status: 201);
      }));

      final msg = await svc.sendMessage('c1', 'Hi');
      expect(msg.id, 'm-resp');
      expect(msg.text, 'Reply');
      expect(msg.role, 'assistant');
    });

    test('includes mode, personality, responseLength in body', () async {
      Map<String, dynamic>? body;
      final svc = _svc(MockClient((req) async {
        body = jsonDecode(req.body) as Map<String, dynamic>;
        return _json({
          'data': _message('m1'),
        }, status: 201);
      }));

      await svc.sendMessage('c1', 'Hi',
          mode: 'creative',
          personality: 'formal',
          responseLength: 'long');
      expect(body!['mode'], 'creative');
      expect(body!['personality'], 'formal');
      expect(body!['response_length'], 'long');
    });

    test('serves cached response for identical prompts', () async {
      var callCount = 0;
      final svc = _svc(MockClient((req) async {
        callCount++;
        return _json({
          'data': _message('m1', text: 'Cached reply'),
        }, status: 201);
      }));

      final first = await svc.sendMessage('c1', 'Hello');
      final second = await svc.sendMessage('c1', 'Hello');
      expect(first.text, 'Cached reply');
      expect(second.text, 'Cached reply');
      expect(callCount, 1, reason: 'Second call should hit cache');
    });

    test('throws on non-success status', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 500)));

      expect(
        () => svc.sendMessage('c1', 'Hi'),
        throwsA(isA<ChatServiceException>()),
      );
    });

    test('throws when data is null in response', () async {
      final svc =
          _svc(MockClient((_) async => _json({'data': null}, status: 201)));

      expect(
        () => svc.sendMessage('c1', 'Hi'),
        throwsA(isA<ChatServiceException>()),
      );
    });

    test('includes memory_context when provided', () async {
      Map<String, dynamic>? body;
      final svc = _svc(MockClient((req) async {
        body = jsonDecode(req.body) as Map<String, dynamic>;
        return _json({'data': _message('m1')}, status: 201);
      }));

      await svc.sendMessage('c1', 'Hi', memoryContext: 'user likes cats');
      expect(body!['memory_context'], 'user likes cats');
    });

    test('includes reply_to_message_id when provided', () async {
      Map<String, dynamic>? body;
      final svc = _svc(MockClient((req) async {
        body = jsonDecode(req.body) as Map<String, dynamic>;
        return _json({'data': _message('m1')}, status: 201);
      }));

      await svc.sendMessage('c1', 'Hi', replyToMessageId: 'parent-msg');
      expect(body!['reply_to_message_id'], 'parent-msg');
    });
  });

  // ── createChat ────────────────────────────────────────────────────────────

  group('createChat', () {
    test('returns thread id on 201', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {'id': 'new-chat-1'},
          }, status: 201)));

      final id = await svc.createChat(name: 'My Chat');
      expect(id, 'new-chat-1');
    });

    test('throws on non-201', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 500)));

      expect(
        () => svc.createChat(),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── renameChat ────────────────────────────────────────────────────────────

  group('renameChat', () {
    test('sends PATCH with new name', () async {
      String? body;
      final svc = _svc(MockClient((req) async {
        body = req.body;
        return _json({'ok': true});
      }));

      await svc.renameChat('c1', 'Renamed');
      final parsed = jsonDecode(body!) as Map<String, dynamic>;
      expect(parsed['name'], 'Renamed');
    });

    test('throws on non-200', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 403)));

      expect(
        () => svc.renameChat('c1', 'X'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── deleteChat ────────────────────────────────────────────────────────────

  group('deleteChat', () {
    test('succeeds on 204', () async {
      final svc = _svc(MockClient((_) async => http.Response('', 204)));

      await svc.deleteChat('c1'); // no throw
    });

    test('succeeds on 200', () async {
      final svc = _svc(MockClient((_) async => http.Response('', 200)));

      await svc.deleteChat('c1'); // no throw
    });

    test('throws on non-200/204', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 500)));

      expect(
        () => svc.deleteChat('c1'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── cancelQueuedMessage ───────────────────────────────────────────────────

  group('cancelQueuedMessage', () {
    test('succeeds on 200', () async {
      final svc = _svc(MockClient((_) async => http.Response('', 200)));

      await svc.cancelQueuedMessage('c1', 'q1'); // no throw
    });

    test('throws on non-200/204', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 500)));

      expect(
        () => svc.cancelQueuedMessage('c1', 'q1'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── clearCache ────────────────────────────────────────────────────────────

  group('clearCache', () {
    test('invalidates cached responses', () async {
      var callCount = 0;
      final svc = _svc(MockClient((req) async {
        callCount++;
        return _json({'data': _message('m1')}, status: 201);
      }));

      await svc.sendMessage('c1', 'Hello');
      expect(callCount, 1);

      svc.clearCache();

      await svc.sendMessage('c1', 'Hello');
      expect(callCount, 2, reason: 'After clearCache, should hit server again');
    });
  });

  // ── shareChat / revokeShare ───────────────────────────────────────────────

  group('shareChat', () {
    test('returns share URL', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {'share_url': 'https://share.test/abc'}
          })));

      final url = await svc.shareChat('c1');
      expect(url, 'https://share.test/abc');
    });

    test('throws on non-200/201', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 500)));

      expect(
        () => svc.shareChat('c1'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  group('revokeShare', () {
    test('succeeds on 200', () async {
      final svc = _svc(MockClient((_) async => http.Response('', 200)));

      await svc.revokeShare('c1'); // no throw
    });

    test('throws on non-200/204', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 403)));

      expect(
        () => svc.revokeShare('c1'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── Agent control ─────────────────────────────────────────────────────────

  group('agent control', () {
    test('getAgentPaused returns boolean from data.paused', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {'paused': true}
          })));

      expect(await svc.getAgentPaused('c1'), isTrue);
    });

    test('getAgentPaused defaults to false', () async {
      final svc = _svc(MockClient((_) async => _json({'data': {}})));

      expect(await svc.getAgentPaused('c1'), isFalse);
    });

    test('pauseAgent returns true on success', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {'paused': true}
          })));

      expect(await svc.pauseAgent('c1'), isTrue);
    });

    test('resumeAgent returns false on success', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {'paused': false}
          })));

      expect(await svc.resumeAgent('c1'), isFalse);
    });

    test('nudgeAgent succeeds on 200', () async {
      final svc = _svc(MockClient((_) async => _json({'ok': true})));

      await svc.nudgeAgent('c1'); // no throw
    });

    test('nudgeAgent throws on error', () async {
      final svc = _svc(MockClient((_) async => http.Response('err', 500)));

      expect(
        () => svc.nudgeAgent('c1'),
        throwsA(isA<ChatServiceException>()),
      );
    });
  });

  // ── Reactions ─────────────────────────────────────────────────────────────

  group('reactions', () {
    test('addReaction returns data map', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {'emoji': '👍', 'count': 1}
          })));

      final result = await svc.addReaction('c1', 'm1', '👍');
      expect(result['emoji'], '👍');
    });

    test('removeReaction succeeds on 200', () async {
      final svc = _svc(MockClient((_) async => http.Response('', 200)));

      await svc.removeReaction('c1', 'm1', '👍'); // no throw
    });

    test('getReactions returns list', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {
              'reactions': [
                {'emoji': '👍', 'count': 2}
              ]
            }
          })));

      final reactions = await svc.getReactions('c1', 'm1');
      expect(reactions, hasLength(1));
    });
  });

  // ── Pins ──────────────────────────────────────────────────────────────────

  group('pins', () {
    test('pinMessage succeeds on 200', () async {
      final svc = _svc(MockClient((_) async => _json({'ok': true})));

      await svc.pinMessage('c1', 'm1'); // no throw
    });

    test('unpinMessage succeeds on 204', () async {
      final svc = _svc(MockClient((_) async => http.Response('', 204)));

      await svc.unpinMessage('c1', 'm1'); // no throw
    });

    test('getPinnedMessages returns list', () async {
      final svc = _svc(MockClient((_) async => _json({
            'data': {
              'pins': [
                {'message_id': 'm1'}
              ]
            }
          })));

      final pins = await svc.getPinnedMessages('c1');
      expect(pins, hasLength(1));
    });
  });
}
