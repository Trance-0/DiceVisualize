"use client";

import { useState, useEffect, useCallback } from "react";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  ChartData,
  ChartOptions,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController
);

const MAX_SIMULATIONS = 200000;

type Operation = "sum" | "min" | "max";

interface DiceRoll {
  trial: number;
  sides: number;
}

interface DistributionResult {
  values: number[];
  probabilities: number[];
  totalOutcomesText: string;
}

function parseDiceExpression(expression: string): DiceRoll[] {
  const sanitized = expression.replace(/\s+/g, "");

  if (!sanitized) {
    throw new Error("Expression cannot be empty.");
  }

  if (sanitized.includes("/") || sanitized.includes("*") || sanitized.includes("-") || sanitized.includes("(") || sanitized.includes(")")) {
    throw new Error("Only + is supported between dice terms. Use formats like '1d6' or '2d10+1d4'.");
  }

  const parseNode = (expr: string): DiceRoll => {
    if (expr.includes("d")) {
      const match = expr.match(/^(\d+)d(\d+)$/);
      if (!match) {
        throw new Error("Invalid base dice expression. Use format like '1d6' or constant '1'.");
      }

      const trial = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);

      if (!Number.isInteger(trial) || !Number.isInteger(sides) || trial <= 0 || sides <= 0) {
        throw new Error("Dice counts and sides must be positive integers.");
      }

      return { trial, sides };
    }

    const value = parseInt(expr, 10);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Constants must be non-negative integers.");
    }

    return {
      trial: value,
      sides: 1,
    };
  };

  return sanitized.split("+").filter(Boolean).map(parseNode);
}

function rollOnce(diceRolls: DiceRoll[]): number {
  let total = 0;
  for (const roll of diceRolls) {
    if (roll.sides === 1) {
      total += roll.trial;
      continue;
    }
    for (let j = 0; j < roll.trial; j++) {
      total += Math.floor(Math.random() * roll.sides) + 1;
    }
  }
  return total;
}

function getMonteCarloDistribution(
  diceRolls: DiceRoll[],
  numSimulations: number,
  operation: Operation
): DistributionResult {
  const safeNumSimulations = Math.min(Math.max(1, Math.floor(numSimulations)), MAX_SIMULATIONS);
  const counts = new Map<number, number>();

  for (let i = 0; i < safeNumSimulations; i++) {
    const first = rollOnce(diceRolls);
    let result = first;

    if (operation === "min" || operation === "max") {
      const second = rollOnce(diceRolls);
      result = operation === "min" ? Math.min(first, second) : Math.max(first, second);
    }

    counts.set(result, (counts.get(result) || 0) + 1);
  }

  const values = Array.from(counts.keys()).sort((a, b) => a - b);
  const probabilities = values.map((value) => (counts.get(value) || 0) / safeNumSimulations);

  return {
    values,
    probabilities,
    totalOutcomesText: `${safeNumSimulations.toLocaleString()} simulations`,
  };
}

function convolve(base: Map<number, number>, outcomes: number[]): Map<number, number> {
  const next = new Map<number, number>();
  for (const [sum, probability] of base.entries()) {
    for (const outcome of outcomes) {
      next.set(sum + outcome, (next.get(sum + outcome) || 0) + probability / outcomes.length);
    }
  }
  return next;
}

function getBaseExactDistribution(diceRolls: DiceRoll[]): Map<number, number> {
  let pmf = new Map<number, number>([[0, 1]]);

  for (const roll of diceRolls) {
    if (roll.sides === 1) {
      const shifted = new Map<number, number>();
      for (const [sum, probability] of pmf.entries()) {
        shifted.set(sum + roll.trial, probability);
      }
      pmf = shifted;
      continue;
    }

    const singleDieOutcomes = Array.from({ length: roll.sides }, (_, i) => i + 1);
    for (let i = 0; i < roll.trial; i++) {
      pmf = convolve(pmf, singleDieOutcomes);
    }
  }

  return pmf;
}

function transformAdvantageLike(pmf: Map<number, number>, operation: Operation): Map<number, number> {
  if (operation === "sum") {
    return pmf;
  }

  const values = Array.from(pmf.keys()).sort((a, b) => a - b);
  const probabilities = values.map((value) => pmf.get(value) || 0);
  const cdf: number[] = [];
  let running = 0;
  for (const p of probabilities) {
    running += p;
    cdf.push(running);
  }

  const transformed = new Map<number, number>();

  if (operation === "max") {
    for (let i = 0; i < values.length; i++) {
      const prev = i === 0 ? 0 : cdf[i - 1];
      const curr = cdf[i];
      transformed.set(values[i], curr * curr - prev * prev);
    }
    return transformed;
  }

  for (let i = 0; i < values.length; i++) {
    const prev = i === 0 ? 0 : cdf[i - 1];
    const curr = cdf[i];
    transformed.set(values[i], Math.pow(1 - prev, 2) - Math.pow(1 - curr, 2));
  }
  return transformed;
}

function getExactDistribution(diceRolls: DiceRoll[], operation: Operation): DistributionResult {
  const base = getBaseExactDistribution(diceRolls);
  const pmf = transformAdvantageLike(base, operation);
  const values = Array.from(pmf.keys()).sort((a, b) => a - b);
  const probabilities = values.map((value) => pmf.get(value) || 0);

  let totalOutcomesText = `${values.length.toLocaleString()} distinct outcomes`;
  if (operation === "sum") {
    totalOutcomesText = `${values.length.toLocaleString()} distinct outcomes (exact)`;
  } else {
    totalOutcomesText = `${values.length.toLocaleString()} distinct outcomes after 2-roll ${operation === "max" ? "advantage" : "disadvantage"} transform`;
  }

  return {
    values,
    probabilities,
    totalOutcomesText,
  };
}

function calculateStats(values: number[], probabilities: number[]) {
  if (!values.length || !probabilities.length) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      expected: 0,
      median: 0,
      stdDev: 0,
      totalOutcomes: 0,
    };
  }

  const min = values[0];
  const max = values[values.length - 1];
  const mean = values.reduce((acc, value, index) => acc + value * probabilities[index], 0);
  const expected = mean;

  let cumulative = 0;
  let median = values[0];
  for (let i = 0; i < values.length; i++) {
    cumulative += probabilities[i];
    if (cumulative >= 0.5) {
      median = values[i];
      break;
    }
  }

  const variance = values.reduce((acc, value, index) => {
    return acc + probabilities[index] * Math.pow(value - mean, 2);
  }, 0);

  return {
    min,
    max,
    mean,
    expected,
    median,
    stdDev: Math.sqrt(variance),
    totalOutcomes: values.length,
  };
}

function getOperationHelp(operation: Operation): string {
  switch (operation) {
    case "min":
      return "Disadvantage here means: roll the full expression twice independently and keep the lower total. This generalizes the standard D&D lower-of-two-rolls idea.";
    case "max":
      return "Advantage here means: roll the full expression twice independently and keep the higher total. This generalizes the standard D&D higher-of-two-rolls idea.";
    default:
      return "Sum means: evaluate the expression once and add all dice normally.";
  }
}

export default function Home() {
  const [expression, setExpression] = useState("1d6");
  const [numSimulations, setNumSimulations] = useState(1000);
  const [operation, setOperation] = useState<Operation>("sum");
  const [values, setValues] = useState<number[]>([]);
  const [probabilities, setProbabilities] = useState<number[]>([]);
  const [totalOutcomesText, setTotalOutcomesText] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [useMonteCarlo, setUseMonteCarlo] = useState(true);
  const [shouldCompute, setShouldCompute] = useState(false);

  const computeDistribution = useCallback(() => {
    try {
      const diceRolls = parseDiceExpression(expression);

      if (useMonteCarlo) {
        if (!Number.isInteger(numSimulations) || numSimulations <= 0) {
          throw new Error("Simulation count must be a positive integer.");
        }
        if (numSimulations > MAX_SIMULATIONS) {
          throw new Error(`Simulation count must be ${MAX_SIMULATIONS.toLocaleString()} or less.`);
        }
      }

      const result = useMonteCarlo
        ? getMonteCarloDistribution(diceRolls, numSimulations, operation)
        : getExactDistribution(diceRolls, operation);

      setValues(result.values);
      setProbabilities(result.probabilities);
      setTotalOutcomesText(result.totalOutcomesText);
      setError("");
    } catch (e) {
      setValues([]);
      setProbabilities([]);
      setTotalOutcomesText("");
      setError(e instanceof Error ? e.message : "Invalid dice expression. Use format like '1d6' or '2d10+1d4'.");
    }
  }, [expression, numSimulations, operation, useMonteCarlo]);

  useEffect(() => {
    if (useMonteCarlo || shouldCompute) {
      computeDistribution();
      setShouldCompute(false);
    }
  }, [computeDistribution, useMonteCarlo, shouldCompute]);

  const stats = calculateStats(values, probabilities);

  const chartData: ChartData<"bar"> = {
    labels: values,
    datasets: [{
      label: "Probability",
      data: probabilities,
      backgroundColor: "rgba(75, 192, 192, 0.6)",
    }],
  };

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Probability",
        },
      },
      x: {
        title: {
          display: true,
          text: "Result",
        },
      },
    },
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dice Probability Visualizer</h1>

        <div className="grid gap-4 mb-8">
          <div className="flex flex-col gap-2">
            <label htmlFor="diceExpression" className="text-sm font-medium text-gray-700">
              Dice Expression
            </label>
            <div className="text-xs text-gray-500">
              Enter dice expression in format: XdY where X is number of dice and Y is number of sides. Multiple dice can be added with + operator. Large exact rolls such as 70d6 are supported through exact probability convolution rather than raw outcome explosion.
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  id="diceExpression"
                  type="text"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="e.g., 1d6, 2d10+1d4"
                  className="w-full p-2 border rounded"
                />
              </div>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value as Operation)}
                className="p-2 border rounded"
                title={getOperationHelp(operation)}
              >
                <option value="sum">Sum (default rolls)</option>
                <option value="min">Disadvantage</option>
                <option value="max">Advantage</option>
              </select>
            </div>
            <div className="text-xs text-gray-500">
              {getOperationHelp(operation)}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useMonteCarlo}
                  onChange={(e) => setUseMonteCarlo(e.target.checked)}
                  className="w-4 h-4"
                />
                Use Monte Carlo Simulation
              </label>
            </div>

            <div className="text-xs text-gray-500">
              Monte Carlo is capped at {MAX_SIMULATIONS.toLocaleString()} simulations to avoid freezing weaker devices. Exact mode is recommended when you need deterministic results.
            </div>
            <div>
              {useMonteCarlo && (
                <input
                  type="number"
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(parseInt(e.target.value, 10) || 0)}
                  min="1"
                  max={MAX_SIMULATIONS}
                  className="w-32 p-2 border rounded"
                  title={`Number of simulations to run (1-${MAX_SIMULATIONS.toLocaleString()})`}
                />
              )}
              {!useMonteCarlo && (
                <button
                  onClick={() => setShouldCompute(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Compute
                </button>
              )}
            </div>
          </div>

          {error && <div className="text-red-500">{error}</div>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 border rounded bg-white">
              <div className="text-sm text-gray-500">Min</div>
              <div className="text-xl font-bold">{stats.min}</div>
            </div>
            <div className="p-4 border rounded bg-white">
              <div className="text-sm text-gray-500">Max</div>
              <div className="text-xl font-bold">{stats.max}</div>
            </div>
            <div className="p-4 border rounded bg-white">
              <div className="text-sm text-gray-500">Mean</div>
              <div className="text-xl font-bold">{stats.mean.toFixed(2)}</div>
            </div>
            <div className="p-4 border rounded bg-white">
              <div className="text-sm text-gray-500">Expected</div>
              <div className="text-xl font-bold">{stats.expected.toFixed(2)}</div>
            </div>
          </div>

          {totalOutcomesText && <div className="text-xs text-gray-500">{totalOutcomesText}</div>}
        </div>

        <div className="h-80 sm:h-96 bg-white border rounded p-4">
          <Chart type="bar" data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
