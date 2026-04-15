import 'dart:convert';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// Client for the device actions pipeline (6.15).
///
/// 8 built-in actions: open_app, set_alarm, send_notification,
/// toggle_setting, take_screenshot, navigate_to, run_shortcut,
/// clipboard_copy.  Gemma 4 function-calling routes natural language
/// commands to the appropriate action.
class DeviceActionService {
  DeviceActionService({required AuthenticatedClient client})
      : _client = client;

  final AuthenticatedClient _client;

  Future<List<Map<String, dynamic>>> listActions({String? platform}) async {
    final base = ApiBaseService.currentSync();
    final qs = platform != null ? '?platform=$platform' : '';
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/actions$qs'),
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body)['data'];
    if (data is List) return data.cast<Map<String, dynamic>>();
    if (data is Map<String, dynamic>) {
      return (data['rows'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getBuiltins() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/actions/builtins'),
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body)['data'];
    if (data is List) return data.cast<Map<String, dynamic>>();
    return [];
  }

  Future<Map<String, dynamic>> executeAction({
    required String actionId,
    required String deviceId,
    Map<String, dynamic>? params,
  }) async {
    final base = ApiBaseService.currentSync();
    final r = await _client.postJson(
      Uri.parse('$base/v1/admin/pipeline/actions/$actionId/execute'),
      {
        'device_id': deviceId,
        if (params != null) 'params': params,
      },
    );
    if (r.statusCode != 200 && r.statusCode != 201) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<List<Map<String, dynamic>>> listExecutions() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/actions/executions'),
    );
    if (r.statusCode != 200) return [];
    final data = jsonDecode(r.body)['data'] as Map<String, dynamic>? ?? {};
    return (data['rows'] as List?)?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<Map<String, dynamic>> getPolicy() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/actions/policy'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }

  Future<Map<String, dynamic>> getStats() async {
    final base = ApiBaseService.currentSync();
    final r = await _client.get(
      Uri.parse('$base/v1/admin/pipeline/actions/stats'),
    );
    if (r.statusCode != 200) return {};
    return (jsonDecode(r.body)['data'] as Map<String, dynamic>?) ?? {};
  }
}
