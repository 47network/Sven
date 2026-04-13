import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Client for the audio scribe pipeline (6.14).
///
/// Local speech-to-text orchestration leveraging faster-whisper with
/// 13 high-accuracy languages, configurable local/server routing.
class AudioScribeService {
  AudioScribeService({required AuthenticatedClient client})
      : _client = client;

  final AuthenticatedClient _client;

  Future<Map<String, dynamic>> getConfig() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/scribe/config'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<bool> updateConfig(Map<String, dynamic> updates) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.putJson(
      Uri.parse('$base/v1/admin/pipeline/scribe/config'),
      updates,
    );
    return r.statusCode == 200;
  }

  Future<Map<String, dynamic>> startSession({
    required String source,
    String? language,
    double? durationSeconds,
  }) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/pipeline/scribe/start'),
      {
        'source': source,
        if (language != null) 'language': language,
        if (durationSeconds != null) 'duration_seconds': durationSeconds,
      },
    );
    if (r.statusCode != 200 && r.statusCode != 201) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<Map<String, dynamic>>> listSessions({String? status}) async {
    final base = ApiBaseService.currentSync();
    final qs = status != null ? '?status=$status' : '';
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/scribe/sessions$qs'),
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body)['data'] as Map<String, dynamic>? ?? {};
    return (data['rows'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<Map<String, dynamic>> getStats() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/scribe/stats'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  static const highAccuracyLanguages = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko', 'ar',
  ];

  static const languageLabels = <String, String>{
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'nl': 'Dutch',
    'pl': 'Polish',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
  };
}
