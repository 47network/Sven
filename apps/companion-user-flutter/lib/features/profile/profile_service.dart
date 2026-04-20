import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Service for user profile management (Batch 7.1).
class ProfileService {
  ProfileService(this._client);

  final AuthenticatedClient _client;

  String get _base => ApiBaseService.currentSync();

  /// Fetch the current user's profile.
  Future<Map<String, dynamic>> getProfile() async {
    final r = await _client.get(Uri.parse('$_base/v1/users/me/profile'));
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception('Failed to fetch profile (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return (body['data'] as Map<String, dynamic>?) ?? {};
  }

  /// Update the current user's profile fields.
  Future<Map<String, dynamic>> updateProfile(
      Map<String, dynamic> fields) async {
    final r = await _client.patchJson(
      Uri.parse('$_base/v1/users/me'),
      fields,
    );
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw Exception('Failed to update profile (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return (body['data'] as Map<String, dynamic>?) ?? {};
  }
}
