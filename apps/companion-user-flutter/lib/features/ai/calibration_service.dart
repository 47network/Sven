import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Client for Calibrated Intelligence — confidence scoring,
/// corrections pipeline, feedback loops, and self-improvement metrics.
class CalibrationService {
  CalibrationService({required AuthenticatedClient client})
      : _client = client;

  final AuthenticatedClient _client;

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

  Future<bool> submitFeedback(Map<String, dynamic> signal) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/community-agents/feedback/signal'),
      signal,
    );
    return r.statusCode == 200;
  }

  Future<List<dynamic>> getTaskSummary() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/feedback/task-summary'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  // ── Corrections ───────────────────────────────────────────────────────

  Future<List<dynamic>> getCorrections() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/corrections'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }

  Future<bool> submitCorrection(Map<String, dynamic> body) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/community-agents/corrections'),
      body,
    );
    return r.statusCode == 200 || r.statusCode == 201;
  }

  // ── Self-improvement snapshots ────────────────────────────────────────

  Future<List<dynamic>> getSnapshots() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/community-agents/self-improvement/snapshots'),
    );
    if (r.statusCode != 200) return [];
    return (jsonDecode(r.body)['data'] as List<dynamic>?) ?? [];
  }
}
