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

interface DiceRoll {
  trial: number;
  sides: number;
}

function parseDiceExpression(expression: string): DiceRoll[] {
  const sanitized = expression.replace(/\s+/g, "");

  if (sanitized.includes("/") || sanitized.includes("*") || sanitized.includes("-") || sanitized.includes("(") || sanitized.includes(")")) {
    throw new Error("Only + is supported between dice terms. Use formats like '1d6' or '2d10+1d4'.");
  }

  const parseNode = (expr: string): DiceRoll => {
    if (expr.includes("d")) {
      const match = expr.match(/^(\d+)d(\d+)$/);
      if (!match) {
        throw new Error("Invalid base dice expression. Use format like '1d6' or constant '1'");
      }
      return {
        trial: parseInt(match[1], 10),
        sides: parseInt(match[2], 10),
      };
    }

    const value = parseInt(expr, 10);
    if (Number.isNaN(value)) {
      throw new Error("Invalid constant value. Must be a number.");
    }

    return {
      trial: value,
      sides: 1,
    };
  };

  const components = sanitized.split("+").filter(Boolean);
  const diceRolls: DiceRoll[] = [];
  for (const component of components) {
    diceRolls.push(parseNode(component));
  }
  return diceRolls;
}

function getMonteCarloDistribution(
  diceRolls: DiceRoll[],
  numSimulations: number,
  operation: "sum" | "min" | "max"
): number[] {
  const results: number[] = [];

  for (let i = 0; i < numSimulations; i++) {
    let current = 0;
    let operationSeeded = false;

    for (const roll of diceRolls) {
      for (let j = 0; j < roll.trial; j++) {
        const rollResult = Math.floor(Math.random() * roll.sides) + 1;
        switch (operation) {
          case "sum":
            current += rollResult;
            break;
          case "min":
            current = operationSeeded ? Math.min(current, rollResult) : rollResult;
            operationSeeded = true;
            break;
          case "max":
            current = operationSeeded ? Math.max(current, rollResult) : rollResult;
            operationSeeded = true;
            break;
        }
      }
    }

    results.push(current);
  }

  return results;
}

function getExactDistribution(diceRolls: DiceRoll[], operation: "sum" | "min" | "max"): number[] {
  let results: number[] = [0];

  for (const roll of diceRolls) {
    for (let i = 0; i < roll.trial; i++) {
      const aug: number[] = [];
      for (let j = 0; j < roll.sides; j++) {
        aug.push(j + 1);
      }

      if (operation === "sum") {
        results = results.flatMap((x) => aug.map((y) => x + y));
      } else if (operation === "min") {
        results = results.flatMap((x) => aug.map((y) => (x === 0 ? y : Math.min(x, y))));
      } else {
        results = results.flatMap((x) => aug.map((y) => Math.max(x, y)));
      }
    }
  }

  return results;
}

function calculateStats(distribution: number[]) {
  if (!distribution.length) {
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

  const sorted = [...distribution].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const total = distribution.reduce((a, b) => a + b, 0);
  const mean = total / distribution.length;
  const expected = mean;
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = distribution.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / distribution.length;
  const stdDev = Math.sqrt(variance);

  return {
    min,
    max,
    mean,
    expected,
    median,
    stdDev,
    totalOutcomes: distribution.length,
  };
}

export default function Home() {
  const [expression, setExpression] = useState("1d6");
  const [numSimulations, setNumSimulations] = useState(1000);
  const [operation, setOperation] = useState<"sum" | "min" | "max">("sum");
  const [distribution, setDistribution] = useState<number[]>([]);
  const [error, setError] = useState<string>("");
  const [useMonteCarlo, setUseMonteCarlo] = useState(true);
  const [shouldCompute, setShouldCompute] = useState(false);

  const computeDistribution = useCallback(() => {
    try {
      const diceRolls = parseDiceExpression(expression);
      const results = useMonteCarlo
        ? getMonteCarloDistribution(diceRolls, numSimulations, operation)
        : getExactDistribution(diceRolls, operation);
      setDistribution(results);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid dice expression. Use format like '1d6' or '2d10+1d4'");
    }
  }, [expression, numSimulations, operation, useMonteCarlo]);

  useEffect(() => {
    if (useMonteCarlo || shouldCompute) {
      computeDistribution();
      setShouldCompute(false);
    }
  }, [computeDistribution, useMonteCarlo, shouldCompute]);

  const stats = calculateStats(distribution);

  const chartData: ChartData<"bar"> = {
    labels: Array.from({ length: Math.max(0, stats.max - stats.min + 1) }, (_, i) => i + stats.min),
    datasets: [{
      label: "Probability",
      data: (useMonteCarlo
        ? Array.from({ length: Math.max(0, stats.max - stats.min + 1) }, (_, i) =>
            distribution.filter((x) => x === i + stats.min).length / numSimulations
          )
        : Array.from({ length: Math.max(0, stats.max - stats.min + 1) }, (_, i) =>
            distribution.filter((x) => x === i + stats.min).length / distribution.length
          )),
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
          text: "Frequency",
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
              Enter dice expression in format: XdY where X is number of dice and Y is number of sides. Multiple dice can be added with + operator. Other operators are not supported yet.
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
                onChange={(e) => setOperation(e.target.value as "sum" | "min" | "max")}
                className="p-2 border rounded"
                title="Choose how to combine multiple dice: sum, minimum, or maximum"
              >
                <option value="sum">Sum (default rolls)</option>
                <option value="min">Disadvantage</option>
                <option value="max">Advantage</option>
              </select>
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
              Note that using Monte Carlo will not give exact results, but will be faster for large numbers of rolls.
            </div>
            <div>
              {useMonteCarlo && (
                <input
                  type="number"
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(parseInt(e.target.value, 10) || 1000)}
                  min="100"
                  max="1000000"
                  className="w-32 p-2 border rounded"
                  title="Number of simulations to run"
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
        </div>

        <div className="h-80 sm:h-96 bg-white border rounded p-4">
          <Chart
            type="bar"
            data={chartData}
            options={chartOptions}
          />
        </div>
      </div>
    </div>
  );
}
