import {
  runQAOA,
  runQuantumAnnealing,
  optimizePortfolio,
  type QAOAProblem,
  type AnnealingProblem,
} from '@sven/quantum-sim/algorithms';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'portfolio': {
      const assets = (input.assets as string[]) ?? ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];
      const expectedReturns = (input.expected_returns as number[]) ?? [0.15, 0.12, 0.20, 0.08, 0.06];
      const riskAversion = (input.risk_aversion as number) ?? 0.5;

      // Simple diagonal risk matrix
      const riskMatrix = assets.map((_, i) =>
        assets.map((__, j) => (i === j ? 0.04 + Math.random() * 0.02 : 0.01 * Math.random())),
      );

      const result = optimizePortfolio(assets, expectedReturns, riskMatrix, riskAversion);

      return {
        result: {
          allocation: result.assets.map((a, i) => ({
            asset: a,
            included: result.allocation[i] === 1,
            expectedReturn: expectedReturns[i]?.toFixed(3),
          })),
          portfolioReturn: result.expectedReturn.toFixed(4),
          portfolioRisk: result.risk.toFixed(4),
          sharpeRatio: result.sharpeRatio.toFixed(3),
          method: 'QAOA (Quantum Approximate Optimization)',
        },
      };
    }

    case 'qaoa': {
      const numVariables = (input.num_variables as number) ?? 5;
      const objective = (input.objective as Array<{ variables: number[]; weight: number }>) ?? [
        { variables: [0], weight: 3 },
        { variables: [1], weight: 2 },
        { variables: [2], weight: 5 },
        { variables: [0, 1], weight: -2 },
        { variables: [1, 2], weight: -1 },
      ];

      const problem: QAOAProblem = { numVariables, objective };
      const result = runQAOA(problem, 2, 512);

      const topMeasurements: Record<string, number> = {};
      const sorted = [...result.measurementCounts.entries()].sort((a, b) => b[1] - a[1]);
      for (const [k, v] of sorted.slice(0, 10)) {
        topMeasurements[k] = v;
      }

      return {
        result: {
          bestSolution: result.bestSolution,
          bestCost: result.bestCost.toFixed(4),
          iterations: result.iterations,
          converged: result.convergenceHistory.length > 2 &&
            Math.abs((result.convergenceHistory.at(-1) ?? 0) - (result.convergenceHistory.at(-2) ?? 0)) < 0.01,
          topMeasurements,
        },
      };
    }

    case 'annealing': {
      const numSpins = (input.num_spins as number) ?? 8;
      const couplings = (input.couplings as Array<{ i: number; j: number; strength: number }>) ?? [
        { i: 0, j: 1, strength: -1 },
        { i: 1, j: 2, strength: -1 },
        { i: 2, j: 3, strength: -1 },
        { i: 3, j: 0, strength: -1 },
        { i: 0, j: 2, strength: 0.5 },
      ];
      const fields = (input.fields as Array<{ i: number; strength: number }>) ?? [
        { i: 0, strength: 0.1 },
      ];

      const problem: AnnealingProblem = { numSpins, couplings, fields };
      const result = runQuantumAnnealing(problem, 2000);

      return {
        result: {
          bestState: result.bestState.map((s) => (s === 1 ? '↑' : '↓')).join(' '),
          bestStateRaw: result.bestState,
          bestEnergy: result.bestEnergy.toFixed(4),
          iterations: result.iterations,
          coolingSchedule: result.temperatureSchedule.map((t) => t.toFixed(3)),
          method: 'Quantum-inspired simulated annealing with transverse field',
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: portfolio, qaoa, annealing` };
  }
}
