import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Typing indicators, read receipts, unread counts, and user presence status.
class PresenceService {
  PresenceService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  Future<bool> sendTyping(String chatId, {bool isTyping = true}) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/chats/$chatId/typing'),
      {'is_typing': isTyping},
    );
    return response.statusCode == 200;
  }

  Future<bool> markRead(String chatId, String messageId) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/chats/$chatId/read'),
      {'message_id': messageId},
    );
    return response.statusCode == 200;
  }

  Future<List<ReadReceipt>> getReadReceipts(String chatId) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.get(
      Uri.parse('$base/v1/chats/$chatId/read-receipts'),
    );
    if (response.statusCode != 200) return [];
    final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
    final receipts = data['receipts'] as List;
    return receipts
        .map((r) => ReadReceipt.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  Future<List<UnreadCount>> getUnreadCounts() async {
    final base = ApiBaseService.currentSync();
    final response = await _client.get(
      Uri.parse('$base/v1/chats/unread'),
    );
    if (response.statusCode != 200) return [];
    final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
    final chats = data['chats'] as List;
    return chats
        .map((c) => UnreadCount.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<bool> setPresence(PresenceStatus status,
      {String? statusMessage}) async {
    final base = ApiBaseService.currentSync();
    final body = <String, dynamic>{
      'status': status.name,
    };
    if (statusMessage != null) body['status_message'] = statusMessage;

    final response = await _client.putJson(
      Uri.parse('$base/v1/presence'),
      body,
    );
    return response.statusCode == 200;
  }

  Future<Map<String, PresenceInfo>> queryPresence(List<String> userIds) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/presence/query'),
      {'user_ids': userIds},
    );
    if (response.statusCode != 200) return {};
    final data = jsonDecode(response.body)['data'] as Map<String, dynamic>;
    final users = data['users'] as List;
    final result = <String, PresenceInfo>{};
    for (final u in users) {
      final info = PresenceInfo.fromJson(u as Map<String, dynamic>);
      result[info.userId] = info;
    }
    return result;
  }
}

// -- Models --

enum PresenceStatus { online, away, busy, offline }

class ReadReceipt {
  const ReadReceipt({
    required this.userId,
    required this.lastReadMessageId,
    this.displayName,
    this.readAt,
  });

  final String userId;
  final String lastReadMessageId;
  final String? displayName;
  final DateTime? readAt;

  factory ReadReceipt.fromJson(Map<String, dynamic> json) => ReadReceipt(
        userId: json['user_id'] as String? ?? '',
        lastReadMessageId: json['last_read_message_id'] as String? ?? '',
        displayName: json['display_name'] as String?,
        readAt: json['read_at'] != null
            ? DateTime.tryParse(json['read_at'] as String)
            : null,
      );
}

class UnreadCount {
  const UnreadCount({required this.chatId, required this.count, this.chatName});
  final String chatId;
  final int count;
  final String? chatName;

  factory UnreadCount.fromJson(Map<String, dynamic> json) => UnreadCount(
        chatId: json['chat_id'] as String? ?? '',
        count: json['unread_count'] as int? ?? 0,
        chatName: json['chat_name'] as String?,
      );
}

class PresenceInfo {
  const PresenceInfo({
    required this.userId,
    required this.status,
    this.statusMessage,
    this.lastActive,
  });

  final String userId;
  final PresenceStatus status;
  final String? statusMessage;
  final DateTime? lastActive;

  factory PresenceInfo.fromJson(Map<String, dynamic> json) {
    final raw = json['status'] as String? ?? 'offline';
    final status = PresenceStatus.values.firstWhere(
      (v) => v.name == raw,
      orElse: () => PresenceStatus.offline,
    );
    return PresenceInfo(
      userId: json['user_id'] as String? ?? '',
      status: status,
      statusMessage: json['status_message'] as String?,
      lastActive: json['last_active'] != null
          ? DateTime.tryParse(json['last_active'] as String)
          : null,
    );
  }
}
