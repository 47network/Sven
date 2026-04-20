import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Client for the Federation subsystem — identity, peers, homeserver,
/// community topics, delegations, consent, sovereignty, and health.
class FederationService {
  FederationService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  // ── Identity ──────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getIdentity() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/federation/identity'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<Map<String, dynamic>> generateIdentity() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/federation/identity/generate'),
      {},
    );
    if (r.statusCode != 200 && r.statusCode != 201) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> rotateIdentity() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/federation/identity/rotate'),
      {},
    );
    return r.statusCode == 200;
  }

  // ── Peers ─────────────────────────────────────────────────────────────

  Future<List<dynamic>> getPeers() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(Uri.parse('$base/v1/admin/federation/peers'));
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<bool> handshakePeer(String peerId) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/federation/peers/$peerId/handshake'),
      {},
    );
    return r.statusCode == 200;
  }

  Future<bool> prunePeers() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/federation/peers/prune'),
      {},
    );
    return r.statusCode == 200;
  }

  // ── Homeserver ────────────────────────────────────────────────────────

  Future<List<dynamic>> getConnections() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/federation/homeserver/connections'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<Map<String, dynamic>> getHomeserverStats() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/federation/homeserver/stats'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Community topics ──────────────────────────────────────────────────

  Future<List<dynamic>> getTopics() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/federation/community/topics'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  // ── Consent ───────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getConsent() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(Uri.parse('$base/v1/admin/federation/consent'));
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> updateConsent(Map<String, dynamic> updates) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.putJson(
      Uri.parse('$base/v1/admin/federation/consent'),
      updates,
    );
    return r.statusCode == 200;
  }

  Future<Map<String, dynamic>> getConsentStats() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/federation/consent/stats'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Sovereignty ───────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getSovereignty() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/federation/sovereignty'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> updateSovereignty(Map<String, dynamic> updates) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.patchJson(
      Uri.parse('$base/v1/admin/federation/sovereignty'),
      updates,
    );
    return r.statusCode == 200;
  }

  Future<Map<String, dynamic>> getExportPolicy() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/federation/sovereignty/export-policy'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Health ────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getMeshHealth() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/federation/health/mesh'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> runHealthCheck() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/federation/health/check'),
      {},
    );
    return r.statusCode == 200;
  }
}
