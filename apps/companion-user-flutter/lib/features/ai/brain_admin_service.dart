import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Client for the Brain subsystem — memory graph, quantum fading,
/// emotional intelligence, reasoning chains, and GDPR consent.
class BrainAdminService {
  BrainAdminService({required AuthenticatedClient client}) : _client = client;

  final AuthenticatedClient _client;

  // ── Brain graph ────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getGraph() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(Uri.parse('$base/v1/admin/brain/graph'));
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<Map<String, dynamic>> getDecayTrajectory() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/brain/decay-trajectory'),
      {},
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Quantum fading ────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getQuantumFadeConfig() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/brain/memory/quantum-fade-config'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> updateQuantumFadeConfig(Map<String, dynamic> updates) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.putJson(
      Uri.parse('$base/v1/admin/brain/memory/quantum-fade-config'),
      updates,
    );
    return r.statusCode == 200;
  }

  // ── Emotional intelligence ────────────────────────────────────────────

  Future<List<dynamic>> getEmotionalHistory() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/brain/emotional/history'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<Map<String, dynamic>> getEmotionalSummary() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/brain/emotional/summary'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Reasoning ─────────────────────────────────────────────────────────

  Future<List<dynamic>> getReasoning() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(Uri.parse('$base/v1/admin/brain/reasoning'));
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<Map<String, dynamic>> getReasoningUnderstanding() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/brain/reasoning/understanding'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── GDPR / Memory consent ─────────────────────────────────────────────

  Future<Map<String, dynamic>> getMemoryConsent() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/brain/memory/consent'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> updateMemoryConsent(Map<String, dynamic> updates) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.putJson(
      Uri.parse('$base/v1/admin/brain/memory/consent'),
      updates,
    );
    return r.statusCode == 200;
  }

  Future<Map<String, dynamic>> exportMemory() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/brain/memory/export'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> forgetAll() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/brain/memory/forget'),
      {},
    );
    return r.statusCode == 200;
  }
}
