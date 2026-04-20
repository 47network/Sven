import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Client for the image processing pipeline (6.12).
///
/// Submits images for local Gemma 4 vision analysis with server escalation
/// for complex content. 7 categories: photo, screenshot, document,
/// handwriting, chart, diagram, other.
class ImageProcessingService {
  ImageProcessingService({required AuthenticatedClient client})
    : _client = client;

  final AuthenticatedClient _client;

  Future<Map<String, dynamic>> getPolicy() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/image/policy'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<Map<String, dynamic>> submitJob({
    required String imageRef,
    required String category,
    String? context,
  }) async {
    final base = ApiBaseService.currentSync();
    final r = await _client
        .postJson(Uri.parse('$base/v1/admin/pipeline/image/submit'), {
          'image_ref': imageRef,
          'category': category,
          if (context != null) 'context': context,
        });
    if (r.statusCode != 200 && r.statusCode != 201) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<Map<String, dynamic>>> listJobs({String? status}) async {
    final base = ApiBaseService.currentSync();
    final qs = status != null ? '?status=$status' : '';
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/image/jobs$qs'),
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body)['data'] as Map<String, dynamic>? ?? {};
    return (data['rows'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<Map<String, dynamic>> getStats() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/image/stats'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  static const categories = [
    'photo',
    'screenshot',
    'document',
    'handwriting',
    'chart',
    'diagram',
    'other',
  ];
}
