import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Per-channel notification preferences + DND synced to server (Batch 7.2).
class NotificationPrefsService {
  NotificationPrefsService(this._client);

  final AuthenticatedClient _client;

  String get _base => ApiBaseService.currentSync();

  /// Fetch all notification preferences (channels + DND + global sound).
  Future<Map<String, dynamic>> getPreferences() async {
    final r = await _client.get(
      Uri.parse('$_base/v1/users/me/notification-preferences'),
    );
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception(
          'Failed to fetch notification preferences (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return (body['data'] as Map<String, dynamic>?) ?? {};
  }

  /// Save notification preferences (channels + DND + global sound).
  Future<void> savePreferences(Map<String, dynamic> prefs) async {
    final r = await _client.putJson(
      Uri.parse('$_base/v1/users/me/notification-preferences'),
      prefs,
    );
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception(
          'Failed to save notification preferences (${r.statusCode})');
    }
  }
}
