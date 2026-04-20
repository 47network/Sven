import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Client for the Community Agents subsystem — agent personas,
/// moderation queue, transparency changelog, confidence calibration,
/// corrections pipeline, behavioral patterns, and self-improvement.
class CommunityAgentsService {
  CommunityAgentsService({required AuthenticatedClient client})
    : _client = client;

  final AuthenticatedClient _client;

  // ── Personas ──────────────────────────────────────────────────────────

  Future<List<dynamic>> getPersonas() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/personas'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<Map<String, dynamic>> createPersona(Map<String, dynamic> body) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/community-agents/personas'),
      body,
    );
    if (r.statusCode != 200 && r.statusCode != 201) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  // ── Moderation ────────────────────────────────────────────────────────

  Future<List<dynamic>> getModerationPending() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/moderation/pending'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<bool> reviewModeration(
    String decisionId,
    Map<String, dynamic> body,
  ) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse(
        '$base/v1/admin/community-agents/moderation/$decisionId/review',
      ),
      body,
    );
    return r.statusCode == 200;
  }

  // ── Changelog ─────────────────────────────────────────────────────────

  Future<List<dynamic>> getChangelog() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/changelog'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<bool> publishChangelog(String entryId) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/community-agents/changelog/$entryId/publish'),
      {},
    );
    return r.statusCode == 200;
  }

  // ── Confidence calibration ────────────────────────────────────────────

  Future<Map<String, dynamic>> getCalibration() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/confidence/calibration'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<dynamic>> getLowConfidence() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/confidence/low'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  // ── Feedback ──────────────────────────────────────────────────────────

  Future<List<dynamic>> getFeedbackTaskSummary() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/feedback/task-summary'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  // ── Corrections pipeline ──────────────────────────────────────────────

  Future<List<dynamic>> getCorrections() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/corrections'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<bool> verifyCorrection(String correctionId) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse(
        '$base/v1/admin/community-agents/corrections/$correctionId/verify',
      ),
      {},
    );
    return r.statusCode == 200;
  }

  Future<bool> promoteCorrection(String correctionId) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse(
        '$base/v1/admin/community-agents/corrections/$correctionId/promote',
      ),
      {},
    );
    return r.statusCode == 200;
  }

  // ── Patterns ──────────────────────────────────────────────────────────

  Future<List<dynamic>> getPatterns() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/patterns'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  // ── Self-improvement ──────────────────────────────────────────────────

  Future<List<dynamic>> getSelfImprovementSnapshots() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/self-improvement/snapshots'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }
}
