import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';

class Telemetry {
  static const String _service = 'sven_user_flutter';

  /// In-memory ring buffer of the last [_maxBufferSize] events.
  /// Exposed for diagnostics (e.g. shake-to-report, crash context).
  static final List<Map<String, Object?>> recentEvents = [];
  static const int _maxBufferSize = 200;

  static void logEvent(String name, Map<String, Object?> fields) {
    final payload = <String, Object?>{
      'service': _service,
      'event': name,
      'timestamp': DateTime.now().toIso8601String(),
      ...fields,
    };

    // Always buffer for diagnostics context.
    if (recentEvents.length >= _maxBufferSize) {
      recentEvents.removeAt(0);
    }
    recentEvents.add(payload);

    final encoded = jsonEncode(payload);

    if (kDebugMode) {
      debugPrint(encoded);
    } else {
      // In release builds, write structured events to the system log
      // (visible via `adb logcat` on Android, Console.app on iOS).
      developer.log(encoded, name: _service);
    }
  }
}
