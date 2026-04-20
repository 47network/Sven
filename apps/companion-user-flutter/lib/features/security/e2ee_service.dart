import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pointycastle/export.dart';

import '../../app/authenticated_client.dart';
import '../../app/api_base_service.dart';

/// End-to-end encryption service implementing ECDH (secp256r1) + AES-256-GCM.
///
/// Follows the Matrix/Signal model:
/// - Each device has an EC identity key pair (secp256r1 / P-256)
/// - One-time pre-keys for establishing sessions
/// - HKDF for key derivation from shared secret
///
/// The server never sees plaintext message content.
class E2eeService {
  E2eeService({required AuthenticatedClient client})
      : _client = client,
        _secureStorage = const FlutterSecureStorage();

  final AuthenticatedClient _client;
  final FlutterSecureStorage _secureStorage;
  final _secureRandom = FortunaRandom();

  static const _identityKeyStorageKey = 'e2ee_identity_key';
  static const _deviceIdStorageKey = 'e2ee_device_id';
  static final _domain = ECCurve_secp256r1();

  String? _deviceId;
  ECPrivateKey? _identityPrivateKey;
  ECPublicKey? _identityPublicKey;

  // ── Initialization ─────────────────────────────────────────

  /// Initialise E2EE: load or generate identity keys, register with server.
  Future<void> init() async {
    // Seed the CSPRNG
    final seed = Uint8List(32);
    final rng = Random.secure();
    for (var i = 0; i < 32; i++) {
      seed[i] = rng.nextInt(256);
    }
    _secureRandom.seed(KeyParameter(seed));

    _deviceId = await _secureStorage.read(key: _deviceIdStorageKey);
    if (_deviceId == null) {
      _deviceId = _generateId(16);
      await _secureStorage.write(key: _deviceIdStorageKey, value: _deviceId);
    }

    // Load or generate identity key pair
    final stored = await _secureStorage.read(key: _identityKeyStorageKey);
    if (stored != null) {
      _deserializeKeyPair(stored);
    } else {
      _generateKeyPair();
      await _secureStorage.write(
        key: _identityKeyStorageKey,
        value: _serializeKeyPair(),
      );
    }

    // Upload keys to server
    await uploadDeviceKeys();
  }

  String get deviceId => _deviceId ?? '';

  String get identityKeyBase64 {
    final point = _identityPublicKey!.Q!;
    return base64Encode(point.getEncoded(false));
  }

  // ── Key Upload ─────────────────────────────────────────────

  /// Upload device keys and one-time pre-keys to the server.
  Future<void> uploadDeviceKeys({int otkCount = 50}) async {
    final base = ApiBaseService.currentSync();
    final otks = <Map<String, String>>[];

    for (var i = 0; i < otkCount; i++) {
      final kp = _generateECKeyPair();
      final keyId = _generateId(8);
      final pubPoint = kp.publicKey.Q!;
      otks.add({
        'key_id': keyId,
        'key_data': base64Encode(pubPoint.getEncoded(false)),
      });
    }

    await _client.postJson(
      Uri.parse('$base/v1/e2ee/keys/upload'),
      {
        'device_id': _deviceId,
        'device_name': 'Flutter Mobile',
        'identity_key': identityKeyBase64,
        'signing_key': identityKeyBase64,
        'one_time_keys': otks,
      },
    );
  }

  // ── Key Query ──────────────────────────────────────────────

  /// Query device keys for a list of user IDs.
  Future<Map<String, List<DeviceKeyInfo>>> queryDeviceKeys(
      List<String> userIds) async {
    final base = ApiBaseService.currentSync();
    final response = await _client.postJson(
      Uri.parse('$base/v1/e2ee/keys/query'),
      {'user_ids': userIds},
    );
    if (response.statusCode != 200) return {};

    final data = jsonDecode(response.body)['data']['device_keys']
        as Map<String, dynamic>;
    final result = <String, List<DeviceKeyInfo>>{};
    for (final entry in data.entries) {
      result[entry.key] = (entry.value as List)
          .map((d) => DeviceKeyInfo.fromJson(d as Map<String, dynamic>))
          .toList();
    }
    return result;
  }

  // ── Claim one-time keys ────────────────────────────────────

  /// Claim one-time keys for session establishment with target devices.
  Future<Map<String, ClaimedKey>> claimOneTimeKeys(
    List<({String userId, String deviceId})> targets,
  ) async {
    final base = ApiBaseService.currentSync();
    final claims = targets.map((t) {
      return {'user_id': t.userId, 'device_id': t.deviceId};
    }).toList();
    final response = await _client.postJson(
      Uri.parse('$base/v1/e2ee/keys/claim'),
      {'claims': claims},
    );
    if (response.statusCode != 200) return {};

    final otks = jsonDecode(response.body)['data']['one_time_keys']
        as Map<String, dynamic>;
    return otks.map(
        (k, v) => MapEntry(k, ClaimedKey.fromJson(v as Map<String, dynamic>)));
  }

  // ── Encrypt / Decrypt Messages ─────────────────────────────

  /// Encrypt a message for a specific recipient using ECDH + AES-256-GCM.
  EncryptedPayload encryptMessage(
      String plaintext, String recipientPublicKeyBase64) {
    final recipientPubBytes = base64Decode(recipientPublicKeyBase64);
    final recipientPoint = _domain.curve.decodePoint(recipientPubBytes);
    final recipientPub = ECPublicKey(recipientPoint, _domain);

    // ECDH: shared secret = private * recipientPublic
    final sharedPoint = recipientPub.Q! * _identityPrivateKey!.d;
    final sharedSecretBytes =
        _bigIntToBytes(sharedPoint!.x!.toBigInteger()!, 32);

    // HKDF to derive AES key
    final hkdf = HKDFKeyDerivator(SHA256Digest());
    final info = Uint8List.fromList(utf8.encode('sven-e2ee-v1'));
    hkdf.init(HkdfParameters(sharedSecretBytes, 32, Uint8List(0), info));
    final aesKey = Uint8List(32);
    hkdf.deriveKey(null, 0, aesKey, 0);

    // AES-256-GCM encrypt
    final iv = _randomBytes(12);
    final plaintextBytes = Uint8List.fromList(utf8.encode(plaintext));
    final cipher = GCMBlockCipher(AESEngine());
    cipher.init(
        true, AEADParameters(KeyParameter(aesKey), 128, iv, Uint8List(0)));
    final ciphertext = cipher.process(plaintextBytes);

    return EncryptedPayload(
      algorithm: 'ecdh-p256-aes-256-gcm',
      senderKey: identityKeyBase64,
      ciphertext: base64Encode(ciphertext),
      iv: base64Encode(iv),
      deviceId: _deviceId!,
    );
  }

  /// Decrypt a message from a sender.
  String decryptMessage(EncryptedPayload payload) {
    final senderPubBytes = base64Decode(payload.senderKey);
    final senderPoint = _domain.curve.decodePoint(senderPubBytes);
    final senderPub = ECPublicKey(senderPoint, _domain);

    // ECDH: shared secret = private * senderPublic
    final sharedPoint = senderPub.Q! * _identityPrivateKey!.d;
    final sharedSecretBytes =
        _bigIntToBytes(sharedPoint!.x!.toBigInteger()!, 32);

    // HKDF to derive AES key
    final hkdf = HKDFKeyDerivator(SHA256Digest());
    final info = Uint8List.fromList(utf8.encode('sven-e2ee-v1'));
    hkdf.init(HkdfParameters(sharedSecretBytes, 32, Uint8List(0), info));
    final aesKey = Uint8List(32);
    hkdf.deriveKey(null, 0, aesKey, 0);

    // AES-256-GCM decrypt
    final iv = Uint8List.fromList(base64Decode(payload.iv));
    final ciphertext = Uint8List.fromList(base64Decode(payload.ciphertext));
    final cipher = GCMBlockCipher(AESEngine());
    cipher.init(
        false, AEADParameters(KeyParameter(aesKey), 128, iv, Uint8List(0)));
    final plaintext = cipher.process(ciphertext);

    return utf8.decode(plaintext);
  }

  // ── Crypto Helpers ─────────────────────────────────────────

  void _generateKeyPair() {
    final kp = _generateECKeyPair();
    _identityPrivateKey = kp.privateKey;
    _identityPublicKey = kp.publicKey;
  }

  AsymmetricKeyPair<ECPublicKey, ECPrivateKey> _generateECKeyPair() {
    final gen = ECKeyGenerator();
    gen.init(ParametersWithRandom(
      ECKeyGeneratorParameters(_domain),
      _secureRandom,
    ));
    final pair = gen.generateKeyPair();
    return AsymmetricKeyPair<ECPublicKey, ECPrivateKey>(
      pair.publicKey as ECPublicKey,
      pair.privateKey as ECPrivateKey,
    );
  }

  Uint8List _bigIntToBytes(BigInt value, int length) {
    final result = Uint8List(length);
    var v = value;
    for (var i = length - 1; i >= 0; i--) {
      result[i] = (v & BigInt.from(0xff)).toInt();
      v >>= 8;
    }
    return result;
  }

  Uint8List _randomBytes(int length) {
    final bytes = Uint8List(length);
    for (var i = 0; i < length; i++) {
      bytes[i] = _secureRandom.nextUint8();
    }
    return bytes;
  }

  String _generateId(int length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return List.generate(
        length, (_) => chars[Random.secure().nextInt(chars.length)]).join();
  }

  String _serializeKeyPair() {
    final pubBytes = _identityPublicKey!.Q!.getEncoded(false);
    final privBytes = _bigIntToBytes(_identityPrivateKey!.d!, 32);
    return jsonEncode({
      'public': base64Encode(pubBytes),
      'private': base64Encode(privBytes),
    });
  }

  void _deserializeKeyPair(String serialized) {
    final data = jsonDecode(serialized) as Map<String, dynamic>;
    final pubBytes = base64Decode(data['public'] as String);
    final privBytes = base64Decode(data['private'] as String);

    final point = _domain.curve.decodePoint(pubBytes);
    _identityPublicKey = ECPublicKey(point, _domain);

    var d = BigInt.zero;
    for (final b in privBytes) {
      d = (d << 8) | BigInt.from(b);
    }
    _identityPrivateKey = ECPrivateKey(d, _domain);
  }
}

/// Represents an encrypted message payload.
class EncryptedPayload {
  const EncryptedPayload({
    required this.algorithm,
    required this.senderKey,
    required this.ciphertext,
    required this.iv,
    required this.deviceId,
    this.sessionId,
  });

  final String algorithm;
  final String senderKey;
  final String ciphertext;
  final String iv;
  final String deviceId;
  final String? sessionId;

  Map<String, dynamic> toJson() => {
        'algorithm': algorithm,
        'sender_key': senderKey,
        'ciphertext': ciphertext,
        'iv': iv,
        'device_id': deviceId,
        if (sessionId != null) 'session_id': sessionId,
      };

  factory EncryptedPayload.fromJson(Map<String, dynamic> json) {
    return EncryptedPayload(
      algorithm: json['algorithm'] as String? ?? '',
      senderKey: json['sender_key'] as String? ??
          json['e2ee_sender_key'] as String? ??
          '',
      ciphertext: json['ciphertext'] as String? ??
          json['e2ee_ciphertext'] as String? ??
          '',
      iv: json['iv'] as String? ?? '',
      deviceId: json['device_id'] as String? ??
          json['e2ee_device_id'] as String? ??
          '',
      sessionId:
          json['session_id'] as String? ?? json['e2ee_session_id'] as String?,
    );
  }
}

/// Device key info returned from the server.
class DeviceKeyInfo {
  const DeviceKeyInfo({
    required this.deviceId,
    required this.identityKey,
    required this.signingKey,
    this.deviceName = '',
    this.verified = false,
  });

  final String deviceId;
  final String identityKey;
  final String signingKey;
  final String deviceName;
  final bool verified;

  factory DeviceKeyInfo.fromJson(Map<String, dynamic> json) {
    return DeviceKeyInfo(
      deviceId: json['device_id'] as String? ?? '',
      identityKey: json['identity_key'] as String? ?? '',
      signingKey: json['signing_key'] as String? ?? '',
      deviceName: json['device_name'] as String? ?? '',
      verified: json['verified'] as bool? ?? false,
    );
  }
}

/// Claimed one-time key.
class ClaimedKey {
  const ClaimedKey(
      {required this.keyId, required this.keyData, this.fallback = false});

  final String keyId;
  final String keyData;
  final bool fallback;

  factory ClaimedKey.fromJson(Map<String, dynamic> json) {
    return ClaimedKey(
      keyId: json['key_id'] as String? ?? '',
      keyData: json['key_data'] as String? ?? '',
      fallback: json['fallback'] as bool? ?? false,
    );
  }
}
