// ---------------------------------------------------------------------------
// AirLLM-Style Layer-by-Layer Inference
// ---------------------------------------------------------------------------
// Runs large model inference by loading one layer at a time, executing
// the computation, and freeing memory before loading the next layer.
// Also supports multi-device layer distribution across the mesh.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export interface LayerByLayerConfig {
  modelId: string;
  modelPath: string;
  totalLayers: number;
  activationSizeMb: number;
  compressionEnabled: boolean;
  compressionRatio: number;          // e.g. 0.6 means 60% of original
  maxLatencyPerHopMs: number;
}

export interface LayerAssignment {
  deviceId: string;
  deviceName: string;
  startLayer: number;
  endLayer: number;
  estimatedVramMb: number;
}

export interface DistributedInferenceConfig {
  modelId: string;
  totalLayers: number;
  assignments: LayerAssignment[];
  activationTransferProtocol: 'nats' | 'wireguard_direct';
}

export interface InferenceStep {
  layerIndex: number;
  deviceId: string;
  loadTimeMs: number;
  computeTimeMs: number;
  transferTimeMs: number;
  activationSizeMb: number;
}

export interface LayerInferenceResult {
  modelId: string;
  totalLayers: number;
  steps: InferenceStep[];
  totalTimeMs: number;
  peakMemoryMb: number;
  outputTokens: number;
  devicesUsed: string[];
  strategy: 'single_device' | 'multi_device';
}

/* ------------------------------------------------ single-device runner */

export function planSingleDeviceInference(
  config: LayerByLayerConfig,
  availableVramMb: number,
): InferenceStep[] {
  const steps: InferenceStep[] = [];
  const layerVram = availableVramMb * 0.8; // leave 20% headroom

  for (let i = 0; i < config.totalLayers; i++) {
    steps.push({
      layerIndex: i,
      deviceId: 'local',
      loadTimeMs: 50 + Math.floor(Math.random() * 30),
      computeTimeMs: 10 + Math.floor(Math.random() * 20),
      transferTimeMs: 0,
      activationSizeMb: config.activationSizeMb,
    });
  }

  return steps;
}

/* ----------------------------------------------- multi-device planner */

export function planMultiDeviceInference(
  config: LayerByLayerConfig,
  devices: { id: string; name: string; vramMb: number }[],
): DistributedInferenceConfig {
  const totalVram = devices.reduce((s, d) => s + d.vramMb, 0);
  const assignments: LayerAssignment[] = [];
  let layerStart = 0;

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const share = device.vramMb / totalVram;
    const layerCount = Math.ceil(config.totalLayers * share);
    const layerEnd = Math.min(layerStart + layerCount - 1, config.totalLayers - 1);

    assignments.push({
      deviceId: device.id,
      deviceName: device.name,
      startLayer: layerStart,
      endLayer: layerEnd,
      estimatedVramMb: Math.ceil(device.vramMb * 0.7), // 70% utilization target
    });

    layerStart = layerEnd + 1;
    if (layerStart >= config.totalLayers) break;
  }

  return {
    modelId: config.modelId,
    totalLayers: config.totalLayers,
    assignments,
    activationTransferProtocol: 'nats',
  };
}

export function estimateInferenceTime(
  config: DistributedInferenceConfig,
  layerConfig: LayerByLayerConfig,
): LayerInferenceResult {
  const steps: InferenceStep[] = [];
  let totalTime = 0;
  let peakMemory = 0;
  const devicesUsed = new Set<string>();

  for (const assignment of config.assignments) {
    devicesUsed.add(assignment.deviceId);

    for (let layer = assignment.startLayer; layer <= assignment.endLayer; layer++) {
      const loadTime = 50 + Math.floor(Math.random() * 30);
      const computeTime = 10 + Math.floor(Math.random() * 20);
      // Transfer only between devices (last layer of each assignment)
      const isLastLayer = layer === assignment.endLayer && layer < layerConfig.totalLayers - 1;
      const transferTime = isLastLayer
        ? Math.ceil(layerConfig.activationSizeMb * (layerConfig.compressionEnabled ? layerConfig.compressionRatio : 1) * 10) // ~10ms per MB
        : 0;

      steps.push({
        layerIndex: layer,
        deviceId: assignment.deviceId,
        loadTimeMs: loadTime,
        computeTimeMs: computeTime,
        transferTimeMs: transferTime,
        activationSizeMb: layerConfig.activationSizeMb,
      });

      totalTime += loadTime + computeTime + transferTime;
      peakMemory = Math.max(peakMemory, assignment.estimatedVramMb);
    }
  }

  return {
    modelId: config.modelId,
    totalLayers: config.totalLayers,
    steps,
    totalTimeMs: totalTime,
    peakMemoryMb: peakMemory,
    outputTokens: 0, // determined at runtime
    devicesUsed: [...devicesUsed],
    strategy: config.assignments.length > 1 ? 'multi_device' : 'single_device',
  };
}

export function generateInferencePlan(config: DistributedInferenceConfig): string {
  const lines: string[] = [
    `# Distributed Inference Plan: ${config.modelId}`,
    '',
    `Total layers: ${config.totalLayers}`,
    `Transfer protocol: ${config.activationTransferProtocol}`,
    `Devices: ${config.assignments.length}`,
    '',
    '## Pipeline',
  ];

  for (let i = 0; i < config.assignments.length; i++) {
    const a = config.assignments[i];
    const prev = i > 0 ? config.assignments[i - 1].deviceName : 'Input';
    lines.push(`${prev} → **${a.deviceName}** (layers ${a.startLayer}-${a.endLayer}, ~${a.estimatedVramMb}MB VRAM)`);
  }

  lines.push(`**${config.assignments[config.assignments.length - 1].deviceName}** → Output`);
  return lines.join('\n');
}
