import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import 'api_base_service.dart';

/// Result of a .well-known/sven/client discovery probe.
class ServerDiscoveryResult {
  const ServerDiscoveryResult({
    required this.gatewayUrl,
    this.instanceName,
    this.version,
    this.registrationEnabled,
    this.ssoProviders = const [],
  });

  final String gatewayUrl;
  final String? instanceName;
  final String? version;
  final bool? registrationEnabled;
  final List<String> ssoProviders;
}

/// Discovers a Sven gateway from a user-provided domain or URL.
///
/// Discovery flow (mirrors Matrix .well-known pattern):
///
/// 1. If the input is already a full URL (https://...), use it directly.
/// 2. Otherwise treat it as a domain and try `https://{domain}/.well-known/sven/client`.
/// 3. If .well-known succeeds and contains `sven.client.base_url`, use that as the gateway.
/// 4. If .well-known fails, fall back to `https://{domain}` and probe `/v1/health`.
/// 5. If nothing works, throw.
abstract final class ServerDiscoveryService {
  /// Resolve a user-provided input to a validated Sven gateway URL.
  ///
  /// [input] can be:
  /// - A bare domain: `sven.systems`
  /// - A subdomain: `app.sven.systems`
  /// - A full URL: `https://app.sven.systems`
  /// - An IP + port: `192.168.1.100:3000`
  static Future<ServerDiscoveryResult> discover(String input) async {
    final trimmed = input.trim();
    if (trimmed.isEmpty) {
      throw ArgumentError.value(
          input, 'input', 'Server address cannot be empty');
    }

    // Normalize to a base URL.
    String baseUrl;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      baseUrl = _stripTrailingSlash(trimmed);
    } else {
      // Bare domain or ip:port — default to https.
      baseUrl = 'https://${_stripTrailingSlash(trimmed)}';
    }

    // Step 1: Try .well-known discovery on the provided domain.
    final wellKnownResult = await _tryWellKnown(baseUrl);
    if (wellKnownResult != null) return wellKnownResult;

    // Step 2: If the base URL itself is a gateway, probe /v1/health.
    if (await _probeHealth(baseUrl)) {
      return ServerDiscoveryResult(gatewayUrl: baseUrl);
    }

    // Step 3: Common subdomain patterns — try app.{domain} if bare domain was given.
    if (!trimmed.contains('/') &&
        !trimmed.contains(':') &&
        !trimmed.startsWith('http')) {
      final appSubdomain = 'https://app.$trimmed';
      final appWk = await _tryWellKnown(appSubdomain);
      if (appWk != null) return appWk;
      if (await _probeHealth(appSubdomain)) {
        return ServerDiscoveryResult(gatewayUrl: appSubdomain);
      }
    }

    throw StateError(
      'Could not discover a Sven server at "$trimmed". '
      'Please enter the full gateway URL (e.g. https://app.sven.systems).',
    );
  }

  /// Apply the discovered server — sets the API base override and returns the URL.
  static Future<String> applyServer(ServerDiscoveryResult result) async {
    return ApiBaseService.setOverride(result.gatewayUrl);
  }

  /// Reset to the default (compile-time) server.
  static Future<void> resetToDefault() async {
    await ApiBaseService.clearOverride();
  }

  // ── Internal helpers ────────────────────────────────────────────────

  static Future<ServerDiscoveryResult?> _tryWellKnown(String baseUrl) async {
    try {
      final uri = Uri.parse('$baseUrl/.well-known/sven/client');
      final response = await http.get(uri).timeout(const Duration(seconds: 8));
      if (response.statusCode != 200) return null;

      final body = json.decode(response.body) as Map<String, dynamic>;
      final svenClient = body['sven.client'] as Map<String, dynamic>?;
      if (svenClient == null) return null;

      final discoveredUrl = svenClient['base_url'] as String?;
      final gatewayUrl = _stripTrailingSlash(discoveredUrl ?? baseUrl);

      return ServerDiscoveryResult(
        gatewayUrl: gatewayUrl,
        instanceName: svenClient['instance_name'] as String?,
        version: svenClient['version'] as String?,
        registrationEnabled: svenClient['registration_enabled'] as bool?,
        ssoProviders: (svenClient['sso_providers'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
      );
    } on Exception {
      return null;
    }
  }

  static Future<bool> _probeHealth(String baseUrl) async {
    try {
      final uri = Uri.parse('$baseUrl/v1/health');
      final response = await http.get(uri).timeout(const Duration(seconds: 6));
      if (response.statusCode != 200) return false;
      final body = json.decode(response.body) as Map<String, dynamic>;
      // A Sven health endpoint always returns `status`.
      return body.containsKey('status');
    } on Exception {
      return false;
    }
  }

  static String _stripTrailingSlash(String url) {
    var s = url;
    while (s.endsWith('/')) {
      s = s.substring(0, s.length - 1);
    }
    return s;
  }
}
