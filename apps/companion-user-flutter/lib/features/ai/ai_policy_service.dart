import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Client for smart routing (6.4) and privacy isolation (6.11+6.13).
///
/// Smart routing decides local vs cloud based on complexity, network,
/// and user preferences.  Privacy controls enforce maximum-privacy
/// defaults: local inference only, telemetry blocking, outbound
/// request verification.
class AiPolicyService {
  AiPolicyService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  // ── Smart routing ──────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getRoutingPolicy() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/gemma4/routing/policy'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> updateRoutingPolicy(Map<String, dynamic> updates) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.putJson(
      Uri.parse('$base/v1/admin/gemma4/routing/policy'),
      updates,
    );
    return r.statusCode == 200;
  }

  Future<Map<String, dynamic>> getRoutingStats() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/gemma4/routing/stats'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Privacy isolation ──────────────────────────────────────────────────

  Future<Map<String, dynamic>> getPrivacyPolicy() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/gemma4/privacy/policy'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> updatePrivacyPolicy(Map<String, dynamic> updates) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.putJson(
      Uri.parse('$base/v1/admin/gemma4/privacy/policy'),
      updates,
    );
    return r.statusCode == 200;
  }

  Future<Map<String, dynamic>> verifyIsolation() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/gemma4/privacy/verify'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<String>> getBlockedDomains() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/gemma4/privacy/blocked-domains'),
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body)['data'];
    if (data is List) return data.cast<String>();
    if (data is Map<String, dynamic>) {
      return (data['domains'] as List?)?.cast<String>() ?? [];
    }
    return [];
  }

  Future<Map<String, dynamic>> getAuditStats() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/gemma4/privacy/audit-stats'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Module system ──────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> listModules({String? platform}) async {
    final base = ApiBaseService.currentSync();
    final qs = platform != null ? '?platform=$platform' : '';
    final r = await _client.get(
      Uri.parse('$base/v1/admin/gemma4/modules$qs'),
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body)['data'];
    if (data is List) return data.cast<Map<String, dynamic>>();
    if (data is Map<String, dynamic>) {
      return (data['modules'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getRecommendedModules({
    int? ramMb,
    int? storageMb,
    bool? hasGpu,
  }) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/gemma4/modules/recommend'),
      {
        if (ramMb != null) 'ram_mb': ramMb,
        if (storageMb != null) 'storage_mb': storageMb,
        if (hasGpu != null) 'has_gpu': hasGpu,
      },
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body)['data'];
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  Future<Map<String, dynamic>> getModuleStats() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/gemma4/modules/stats'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }
}
