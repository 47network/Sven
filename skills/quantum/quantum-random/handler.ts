import { generateQuantumRandom } from '@sven/quantum-sim/algorithms';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'generate': {
      const numBits = Math.min((input.num_bits as number) ?? 256, 4096);
      const result = generateQuantumRandom(numBits);

      return {
        result: {
          bits: result.bits.length > 128 ? result.bits.slice(0, 128) + '...' : result.bits,
          fullLength: result.numBits,
          entropy: result.entropy.toFixed(6),
          maxEntropy: 1,
          entropyQuality: result.entropy > 0.99 ? 'excellent' : result.entropy > 0.95 ? 'good' : 'fair',
          onesRatio: (result.bits.split('').filter((b) => b === '1').length / result.numBits).toFixed(4),
          method: 'Hadamard superposition measurement',
        },
      };
    }

    case 'bytes': {
      const numBytes = Math.min((input.num_bytes as number) ?? 32, 512);
      const result = generateQuantumRandom(numBytes * 8);

      return {
        result: {
          hex: result.bytes.slice(0, numBytes).map((b) => b.toString(16).padStart(2, '0')).join(''),
          byteCount: Math.min(result.bytes.length, numBytes),
          entropy: result.entropy.toFixed(6),
        },
      };
    }

    case 'uuid': {
      // Generate 128 quantum random bits for a UUID v4
      const result = generateQuantumRandom(128);
      const hex = result.bytes.slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');

      // Format as UUID v4 (set version and variant bits)
      const uuid = [
        hex.slice(0, 8),
        hex.slice(8, 12),
        '4' + hex.slice(13, 16), // version 4
        ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20), // variant
        hex.slice(20, 32),
      ].join('-');

      return {
        result: {
          uuid,
          entropy: result.entropy.toFixed(6),
          method: 'Quantum-generated UUID v4',
        },
      };
    }

    case 'analyze': {
      const numBits = Math.min((input.num_bits as number) ?? 1000, 4096);
      const result = generateQuantumRandom(numBits);

      // Frequency analysis
      const ones = result.bits.split('').filter((b) => b === '1').length;
      const zeros = result.numBits - ones;

      // Runs test (simplified)
      let runs = 1;
      for (let i = 1; i < result.bits.length; i++) {
        if (result.bits[i] !== result.bits[i - 1]) runs++;
      }
      const expectedRuns = 1 + 2 * ones * zeros / result.numBits;

      // Chi-squared for byte distribution (if enough data)
      let chiSquared = 0;
      if (result.bytes.length >= 32) {
        const observed = new Array(256).fill(0) as number[];
        for (const b of result.bytes) observed[b]++;
        const expected = result.bytes.length / 256;
        chiSquared = observed.reduce((sum, obs) => sum + Math.pow(obs - expected, 2) / expected, 0);
      }

      return {
        result: {
          numBits: result.numBits,
          entropy: result.entropy.toFixed(6),
          frequency: {
            ones, zeros,
            onesRatio: (ones / result.numBits).toFixed(4),
            idealRatio: '0.5000',
            deviation: Math.abs(ones / result.numBits - 0.5).toFixed(4),
          },
          runsTest: {
            observedRuns: runs,
            expectedRuns: Math.round(expectedRuns),
            ratio: (runs / expectedRuns).toFixed(3),
            pass: Math.abs(runs / expectedRuns - 1) < 0.1,
          },
          byteDistribution: {
            chiSquared: chiSquared.toFixed(2),
            degreesOfFreedom: 255,
            note: 'Lower chi-squared indicates more uniform distribution',
          },
          verdict: result.entropy > 0.98 ? 'PASS — high-quality randomness' : 'MARGINAL — entropy below threshold',
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: generate, bytes, uuid, analyze` };
  }
}
