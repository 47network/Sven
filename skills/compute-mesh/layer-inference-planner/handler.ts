import {
  planSingleDeviceInference,
  planMultiDeviceInference,
  estimateInferenceTime,
  generateInferencePlan,
  type LayerByLayerConfig,
} from '@sven/compute-mesh/layer-inference';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  const modelId = (input.model_id as string) ?? 'unknown-model';
  const totalLayers = (input.total_layers as number) ?? 80;
  const activationSizeMb = (input.activation_size_mb as number) ?? 2;

  const config: LayerByLayerConfig = {
    modelId,
    modelPath: `/models/${modelId}`,
    totalLayers,
    activationSizeMb,
    compressionEnabled: true,
    compressionRatio: 0.6,
    maxLatencyPerHopMs: 100,
  };

  switch (action) {
    case 'plan_single': {
      const availableVram = (input.available_vram_mb as number) ?? 8_000;
      const steps = planSingleDeviceInference(config, availableVram);
      const totalMs = steps.reduce((s, st) => s + st.loadTimeMs + st.computeTimeMs, 0);
      return {
        result: {
          strategy: 'single_device',
          modelId,
          totalLayers,
          steps: steps.length,
          estimatedTotalMs: totalMs,
          peakMemoryMb: activationSizeMb,
        },
      };
    }

    case 'plan_distributed': {
      const devices = (input.devices as { id: string; name: string; vramMb: number }[]) ?? [];
      if (devices.length === 0) return { error: 'At least one device is required' };
      const plan = planMultiDeviceInference(config, devices);
      return { result: plan };
    }

    case 'estimate': {
      const devices = (input.devices as { id: string; name: string; vramMb: number }[]) ?? [];
      if (devices.length === 0) return { error: 'At least one device is required' };
      const plan = planMultiDeviceInference(config, devices);
      const estimate = estimateInferenceTime(plan, config);
      return { result: estimate };
    }

    case 'visualize': {
      const devices = (input.devices as { id: string; name: string; vramMb: number }[]) ?? [];
      if (devices.length === 0) return { error: 'At least one device is required' };
      const plan = planMultiDeviceInference(config, devices);
      const markdown = generateInferencePlan(plan);
      return { result: { markdown } };
    }

    default:
      return { error: `Unknown action "${action}". Use: plan_single, plan_distributed, estimate, visualize` };
  }
}
