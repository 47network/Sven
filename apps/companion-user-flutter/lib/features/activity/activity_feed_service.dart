import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

class ActivityFeedService {
  ActivityFeedService(this._client);

  final AuthenticatedClient _client;

  String get _apiBase => ApiBaseService.currentSync();

  /// Fetch activity feed events (paginated).
  Future<Map<String, dynamic>> getEvents({
    int limit = 50,
    String? before,
    bool unreadOnly = false,
  }) async {
    final params = <String, String>{
      'limit': '$limit',
      if (before != null) 'before': before,
      if (unreadOnly) 'unread_only': 'true',
    };
    final uri = Uri.parse('$_apiBase/v1/users/me/activity-feed')
        .replace(queryParameters: params);
    final r = await _client.get(uri);
    if (r.statusCode != 200) {
      throw Exception('Failed to fetch activity feed (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return (body['data'] as Map<String, dynamic>?) ?? {};
  }

  /// Mark events as read.
  Future<void> markRead({List<String>? ids, bool all = false}) async {
    final uri = Uri.parse('$_apiBase/v1/users/me/activity-feed/mark-read');
    final payload = <String, dynamic>{};
    if (all) {
      payload['all'] = true;
    } else if (ids != null) {
      payload['ids'] = ids;
    }
    final r = await _client.postJson(uri, payload);
    if (r.statusCode != 200) {
      throw Exception('Failed to mark read (${r.statusCode})');
    }
  }
}
