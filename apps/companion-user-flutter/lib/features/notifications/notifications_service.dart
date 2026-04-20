import 'dart:convert';

import '../../app/api_base_service.dart';
import '../../app/authenticated_client.dart';
import '../../app/telemetry.dart';
import '../auth/auth_errors.dart';

/// Parsed pending notification from the Sven server.
class PendingNotification {
  const PendingNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.channel,
    this.data = const {},
    this.priority = 'normal',
  });

  final String id;
  final String title;
  final String body;
  final String channel;
  final Map<String, dynamic> data;
  final String priority;

  factory PendingNotification.fromJson(Map<String, dynamic> json) {
    return PendingNotification(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      channel: json['channel'] as String? ?? 'sven_messages',
      data: json['data'] is Map<String, dynamic>
          ? json['data'] as Map<String, dynamic>
          : const {},
      priority: json['priority'] as String? ?? 'normal',
    );
  }
}

class NotificationsService {
  NotificationsService({AuthenticatedClient? client})
    : _client = client ?? AuthenticatedClient();

  static String get _apiBase => ApiBaseService.currentSync();

  final AuthenticatedClient _client;

  Future<void> registerToken({
    required String token,
    required String platform,
    String? deviceId,
  }) async {
    final uri = Uri.parse('$_apiBase/v1/push/register');
    try {
      final response = await _client.postJson(uri, {
        'token': token,
        'platform': platform,
        if (deviceId != null) 'device_id': deviceId,
      });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
      Telemetry.logEvent('push.register', {
        'platform': platform,
        if (deviceId != null) 'device_id': deviceId,
      });
    } on AuthException {
      rethrow;
    }
  }

  Future<void> unregisterToken({required String token}) async {
    final uri = Uri.parse('$_apiBase/v1/push/unregister');
    try {
      final response = await _client.postJson(uri, {'token': token});
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
      Telemetry.logEvent('push.unregister', {'token': token});
    } on AuthException {
      rethrow;
    }
  }

  /// Fetch VAPID public key for web push subscription.
  Future<String> getVapidPublicKey() async {
    final uri = Uri.parse('$_apiBase/v1/push/vapid-public-key');
    try {
      final response = await _client.get(uri);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthException(AuthFailure.server);
      }
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return data['publicKey'] as String;
    } on AuthException {
      rethrow;
    } catch (e) {
      throw AuthException(AuthFailure.server);
    }
  }

  /// Fetch pending notifications from the Sven server.
  ///
  /// Called after a data-only FCM wake-up or UnifiedPush signal to retrieve
  /// the actual notification content directly from our server — keeping
  /// Google and Apple out of the notification content path.
  Future<List<PendingNotification>> fetchPending() async {
    final uri = Uri.parse('$_apiBase/v1/push/pending');
    try {
      final response = await _client.get(uri);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return const [];
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final list = body['notifications'] as List<dynamic>? ?? [];
      return list
          .whereType<Map<String, dynamic>>()
          .map(PendingNotification.fromJson)
          .toList();
    } catch (e) {
      return const [];
    }
  }

  /// Acknowledge fetched notifications so they are not delivered again.
  Future<void> ackPending(List<String> ids) async {
    if (ids.isEmpty) return;
    final uri = Uri.parse('$_apiBase/v1/push/ack');
    try {
      await _client.postJson(uri, {'ids': ids});
    } catch (_) {
      // Best-effort acknowledgement; server will expire unfetched payloads.
    }
  }
}
