import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sven_user_flutter/features/inference/on_device_inference_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  group('ModelVariant', () {
    test('minRamMb thresholds are ordered correctly', () {
      expect(ModelVariant.e2b.minRamMb, 4096);
      expect(ModelVariant.e4b.minRamMb, 6144);
      expect(ModelVariant.moe26b.minRamMb, 8192);
      expect(ModelVariant.dense31b.minRamMb, 12288);
      // Each variant requires more RAM than the previous
      expect(ModelVariant.e4b.minRamMb, greaterThan(ModelVariant.e2b.minRamMb));
      expect(
          ModelVariant.moe26b.minRamMb, greaterThan(ModelVariant.e4b.minRamMb));
      expect(ModelVariant.dense31b.minRamMb,
          greaterThan(ModelVariant.moe26b.minRamMb));
    });

    test('estimatedSizeBytes are ordered by model size', () {
      expect(ModelVariant.e2b.estimatedSizeBytes,
          lessThan(ModelVariant.e4b.estimatedSizeBytes));
      expect(ModelVariant.e4b.estimatedSizeBytes,
          lessThan(ModelVariant.moe26b.estimatedSizeBytes));
      expect(ModelVariant.moe26b.estimatedSizeBytes,
          lessThan(ModelVariant.dense31b.estimatedSizeBytes));
    });

    test('displayName contains model size identifier', () {
      expect(ModelVariant.e2b.displayName, contains('2B'));
      expect(ModelVariant.e4b.displayName, contains('4B'));
      expect(ModelVariant.moe26b.displayName, contains('26B'));
      expect(ModelVariant.dense31b.displayName, contains('31B'));
    });

    test('fromString parses known variants and defaults to e2b', () {
      expect(ModelVariant.fromString('e2b'), ModelVariant.e2b);
      expect(ModelVariant.fromString('e4b'), ModelVariant.e4b);
      expect(ModelVariant.fromString('moe26b'), ModelVariant.moe26b);
      expect(ModelVariant.fromString('dense31b'), ModelVariant.dense31b);
      expect(ModelVariant.fromString('unknown'), ModelVariant.e2b);
      expect(ModelVariant.fromString(''), ModelVariant.e2b);
    });
  });

  group('DeviceCapability', () {
    test('ramLabel formats correctly', () {
      const cap = DeviceCapability(totalRamMb: 8192, freeStorageMb: 64000);
      expect(cap.ramLabel, '8.0 GB');
    });

    test('storageLabel formats correctly', () {
      const cap = DeviceCapability(totalRamMb: 4096, freeStorageMb: 32768);
      expect(cap.storageLabel, '32.0 GB');
    });
  });

  group('ModelCompatibility', () {
    test('all enum values exist', () {
      expect(ModelCompatibility.values, hasLength(4));
      expect(
          ModelCompatibility.values, contains(ModelCompatibility.compatible));
      expect(ModelCompatibility.values,
          contains(ModelCompatibility.insufficientRam));
      expect(ModelCompatibility.values,
          contains(ModelCompatibility.insufficientStorage));
      expect(ModelCompatibility.values, contains(ModelCompatibility.unknown));
    });
  });

  group('ModelInstallResult', () {
    test('all enum values exist', () {
      expect(ModelInstallResult.values, hasLength(5));
      expect(ModelInstallResult.values, contains(ModelInstallResult.success));
      expect(ModelInstallResult.values,
          contains(ModelInstallResult.alreadyInstalled));
      expect(ModelInstallResult.values,
          contains(ModelInstallResult.insufficientRam));
      expect(ModelInstallResult.values,
          contains(ModelInstallResult.insufficientStorage));
      expect(ModelInstallResult.values,
          contains(ModelInstallResult.downloadFailed));
    });
  });

  group('OnDeviceInferenceService.checkCompatibility', () {
    late OnDeviceInferenceService service;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      service = OnDeviceInferenceService();
    });

    tearDown(() {
      service.dispose();
    });

    test('returns unknown when device capability not yet probed', () {
      // deviceCapability is null before probe completes
      expect(service.checkCompatibility(ModelVariant.e2b),
          ModelCompatibility.unknown);
    });
  });

  group('OnDeviceInferenceService.recommendedVariant', () {
    late OnDeviceInferenceService service;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      service = OnDeviceInferenceService();
    });

    tearDown(() {
      service.dispose();
    });

    test('defaults to e2b when no device info available', () {
      // deviceCapability is null → totalRamMb fallback is 0 → e2b
      expect(service.recommendedVariant, ModelVariant.e2b);
    });
  });

  group('ModelProfile', () {
    test('fromJson and toJson round-trip', () {
      final profile = ModelProfile(
        id: 'gemma4-e2b',
        name: 'Gemma 4 E2B (2B)',
        variant: ModelVariant.e2b,
        sizeBytes: 1200000000,
        contextWindow: 128000,
        capabilities: ['text', 'vision'],
        installedAt: DateTime.utc(2026, 4, 9),
        status: ModelStatus.ready,
      );
      final json = profile.toJson();
      final restored = ModelProfile.fromJson(json);
      expect(restored.id, profile.id);
      expect(restored.variant, profile.variant);
      expect(restored.sizeBytes, profile.sizeBytes);
      expect(restored.status, profile.status);
    });

    test('sizeLabel formats GB correctly', () {
      final profile = ModelProfile(
        id: 'test',
        name: 'Test',
        variant: ModelVariant.e4b,
        sizeBytes: 2800000000,
        contextWindow: 128000,
        capabilities: [],
        installedAt: DateTime.now().toUtc(),
        status: ModelStatus.ready,
      );
      expect(profile.sizeLabel, '2.6 GB');
    });

    test('copyWith updates status', () {
      final profile = ModelProfile(
        id: 'test',
        name: 'Test',
        variant: ModelVariant.e2b,
        sizeBytes: 1200000000,
        contextWindow: 128000,
        capabilities: [],
        installedAt: DateTime.now().toUtc(),
        status: ModelStatus.downloading,
      );
      final updated = profile.copyWith(status: ModelStatus.ready);
      expect(updated.status, ModelStatus.ready);
      expect(updated.id, profile.id);
    });
  });

  group('InferenceModule', () {
    test('fromJson parses correctly', () {
      final json = {
        'id': 'mod-1',
        'name': 'Translation',
        'description': 'Offline translation',
        'size_bytes': 500000000,
        'installed': true,
        'download_progress': 1.0,
      };
      final module = InferenceModule.fromJson(json);
      expect(module.id, 'mod-1');
      expect(module.name, 'Translation');
      expect(module.installed, true);
      expect(module.sizeBytes, 500000000);
    });
  });
}
