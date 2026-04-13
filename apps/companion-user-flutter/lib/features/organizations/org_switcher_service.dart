import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

class OrgSwitcherService {
  OrgSwitcherService(this._client);

  final AuthenticatedClient _client;

  String get _apiBase => ApiBaseService.currentSync();

  /// Fetch all organisations the user belongs to.
  Future<Map<String, dynamic>> getOrganizations() async {
    final uri = Uri.parse('$_apiBase/v1/users/me/organizations');
    final r = await _client.get(uri);
    if (r.statusCode != 200) {
      throw Exception('Failed to fetch organizations (${r.statusCode})');
    }
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    return (body['data'] as Map<String, dynamic>?) ?? {};
  }

  /// Switch the active organisation.
  Future<void> switchOrganization(String orgId) async {
    final uri = Uri.parse('$_apiBase/v1/users/me/active-organization');
    final r = await _client.putJson(uri, {'organization_id': orgId});
    if (r.statusCode != 200) {
      throw Exception('Failed to switch organization (${r.statusCode})');
    }
  }
}
