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
  ChartOptions,
  ChartData,
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
  const parseNode = (expr: string): DiceRoll => {
    if (expr.includes("d")) {
      const match = expr.match(/^(\d+)d(\d+)$/);
      if (!match) {
        throw new Error("Invalid dice expression. Use format like '1d6' or constant '1'");
      }
      return {
        trial: parseInt(match[1], 10),
        sides: parseInt(match[2], 10)
      };
    } else {
      const num = parseInt(expr, 10);
      if (isNaN(num)) {
        throw new Error("Invalid constant value. Must be a number.");
      }
      return {
        trial: num,
        sides: 1
      };
    }
  };

  const components = expression.split(/[+\-*/]/).filter(c => c.trim() !== "");
  const diceRolls: DiceRoll[] = [];
  for (const component of components) {
    diceRolls.push(parseNode(component));
  };

  return diceRolls;
}

function getMonteCarloDistribution(
  diceRolls: DiceRoll[],
  numSimulations: number,
  operation: "sum" | "min" | "max"
): number[] {
  const results: number[] = new Array(numSimulations).fill(0);

  for (let i = 0; i < numSimulations; i++) {
    let current = 0;
    for (const roll of diceRolls) {
      for (let j = 0; j < roll.trial; j++) {
        const rollResult = Math.floor(Math.random() * roll.sides) + 1;
        switch (operation) {
          case "sum":
            current += rollResult;
            break;
          case "min":
            current = i === 0 ? rollResult : Math.min(current, rollResult);
            break;
          case "max":
            current = i === 0 ? rollResult : Math.max(current, rollResult);
            break;
        }
      }
    }
    results[i] = current;
  }

  return results;
}

function getExactDistribution(diceRolls: DiceRoll[], operation: "sum" | "min" | "max"): number[] {
  let results: number[] = [0];
  let sideCount = 0;

  for (const roll of diceRolls) {
    sideCount += roll.trial * roll.sides;
  }

  results = new Array(sideCount).fill(0);

  for (let i = 0; i < results.length; i++) {
    results[i] = i + 1;
  }

  for (const roll of diceRolls) {
    const aug: number[] = [];
    for (let j = 0; j < roll.sides; j++) {
      aug.push(j + 1);
    }

    const newResults: number[] = [];
    for (const prev of results) {
      for (const value of aug) {
        newResults.push(prev + value);
      }
    }
    results = newResults;
  }

  if (operation !== "sum") {
    const maxResults = results.reduce((max, val) => Math.max(max, val), 0);
    const minVal = results[0];
    results = new Array(maxResults - minVal + 1).fill(0);
    for (let i = minVal; i <= maxResults; i++) {
      results[i - minVal] = i;
    }
  }

  return results;
}

function calculateStats(distribution: number[], useMonteCarlo: boolean) {
  const numValues = useMonteCarlo ? distribution.length : distribution.length;
  const sum = distribution.reduce((a, b) => a + b, 0);
  const mean = sum / numValues;
  const sorted = [...distribution].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];

  // Mode
  const freq: Record<number, number> = {};
  distribution.forEach(x => {
    freq[x] = (freq[x] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(freq));
  const modes = Object.keys(freq)
    .filter(k => freq[parseInt(k)] === maxFreq)
    .map(k => parseInt(k));

  // Standard deviation
  const variance = distribution.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numValues;
  const stdDev = Math.sqrt(variance);

  return {
    min,
    max,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    mode: modes.length === distribution.length ? [] : modes,
    stdDev: Number(stdDev.toFixed(2)),
    expected: Number(mean.toFixed(2)),
    totalOutcomes: numValues
  };
}

export default function Home() {
  const [expression, setExpression] = useState("1d6");
  const [numSimulations, setNumSimulations] = useState(10000);
  const [operation, setOperation] = useState<"sum" | "min" | "max">("sum");
  const [distribution, setDistribution] = useState<number[]>([]);
  const [error, setError] = useState<string>("");
  const [useMonteCarlo, setUseMonteCarlo] = useState(false);
  const [shouldCompute, setShouldCompute] = useState(false);
  const [loading, setLoading] = useState(false);

  const computeDistribution = useCallback(() => {
    try {
      setLoading(true);
      const diceRolls = parseDiceExpression(expression);
      if (diceRolls.length === 0) {
        throw new Error("Please enter a dice expression or constant.");
      }

      const results = useMonteCarlo
        ? getMonteCarloDistribution(diceRolls, numSimulations, operation)
        : getExactDistribution(diceRolls, operation);
      setDistribution(results);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid dice expression. Use format like '1d6', '2d10+1d4', or '10'.");
    } finally {
      setLoading(false);
    }
  }, [expression, numSimulations, operation, useMonteCarlo]);

  useEffect(() => {
    if (useMonteCarlo || shouldCompute) {
      computeDistribution();
      setShouldCompute(false);
    }
  }, [shouldCompute, computeDistribution]);

  const stats = distribution.length ? calculateStats(distribution, useMonteCarlo) : {
    min: 0,
    max: 0,
    mean: 0,
    median: 0,
    mode: [],
    stdDev: 0,
    expected: 0,
    totalOutcomes: 0
  };

  const chartData: ChartData<"bar"> = {
    labels: Array.from({ length: stats.max - stats.min + 1 }, (_, i) => i + stats.min),
    datasets: [{
      label: "Probability",
      data: useMonteCarlo
        ? Array.from({ length: stats.max - stats.min + 1 }, (_, i) =>
            distribution.filter(x => x === i + stats.min).length / numSimulations
          )
        : Array.from({ length: stats.max - stats.min + 1 }, (_, i) =>
            distribution.filter(x => x === i + stats.min).length / stats.totalOutcomes
          ),
      backgroundColor: "rgba(59, 130, 246, 0.6)",
      borderColor: "rgba(59, 130, 246, 1)",
      borderWidth: 1,
      borderRadius: 4,
    }]
  };

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Frequency / Probability",
          font: { size: 12 }
        },
        ticks: {
          color: "#6b7280"
        },
        grid: {
          color: "#e5e7eb"
        }
      },
      x: {
        title: {
          display: true,
          text: "Result",
          font: { size: 12 }
        },
        ticks: {
          color: "#6b7280"
        },
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          color: "#374151",
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎲 Dice Visualizer
          </h1>
          <p className="text-gray-600 text-lg">
            Probability Visualization for CoC & DnD Dice
          </p>
        </header>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="grid gap-6">
            <div>
              <label htmlFor="diceExpression" className="block text-sm font-semibold text-gray-700 mb-2">
                Dice Expression
              </label>
              <div className="text-xs text-gray-500 mb-2">
                Enter dice expression in format: XdY where X is number of dice and Y is number of sides. Multiple dice can be combined with +, -, *, / operators. Other operators are not supported yet.
              </div>
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <input
                    id="diceExpression"
                    type="text"
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="e.g., 1d6, 2d10+1d4, 4d6"
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value as "sum" | "min" | "max")}
                  className="p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors bg-white"
                  title="Choose how to combine multiple dice"
                >
                  <option value="sum">Sum (default rolls)</option>
                  <option value="min">Disadvantage</option>
                  <option value="max">Advantage</option>
                </select>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMonteCarlo}
                    onChange={(e) => setUseMonteCarlo(e.target.checked)}
                    className="w-5 h-5 accent-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700">Use Monte Carlo Simulation</span>
                </label>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="text-xs text-gray-500">
                  {!useMonteCarlo && "Click 'Compute' to calculate exact probabilities"}
                  {useMonteCarlo && "Note: Monte Carlo gives approximate probabilities, not exact"}
                </div>
              </div>
              {useMonteCarlo && (
                <div className="mt-3 flex items-center gap-4">
                  <input
                    type="number"
                    value={numSimulations}
                    onChange={(e) => setNumSimulations(parseInt(e.target.value) || 1000)}
                    min="100"
                    max="1000000"
                    className="w-40 p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                    title="Number of simulations to run"
                  />
                  <span className="text-sm text-gray-600">simulations</span>
                </div>
              )}
              {!useMonteCarlo && (
                <button
                  onClick={() => setShouldCompute(true)}
                  disabled={loading}
                  className="mt-4 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Computing..." : "Compute Exact Distribution"}
                </button>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {distribution.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
                <div className="text-sm text-gray-500 mb-1">Minimum</div>
                <div className="text-2xl font-bold text-gray-900">{stats.min}</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
                <div className="text-sm text-gray-500 mb-1">Maximum</div>
                <div className="text-2xl font-bold text-gray-900">{stats.max}</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
                <div className="text-sm text-gray-500 mb-1">Mean</div>
                <div className="text-2xl font-bold text-gray-900">{stats.mean}</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-orange-500">
                <div className="text-sm text-gray-500 mb-1">Median</div>
                <div className="text-2xl font-bold text-gray-900">{stats.median}</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-pink-500">
                <div className="text-sm text-gray-500 mb-1">Standard Deviation</div>
                <div className="text-2xl font-bold text-gray-900">{stats.stdDev}</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-cyan-500">
                <div className="text-sm text-gray-500 mb-1">Total Outcomes</div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalOutcomes.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-teal-500">
                <div className="text-sm text-gray-500 mb-1">Expected Value</div>
                <div className="text-2xl font-bold text-gray-900">{stats.expected}</div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-indigo-500">
                <div className="text-sm text-gray-500 mb-1">Mode(s)</div>
                <div className="text-2xl font-bold text-gray-900 flex-wrap">
                  {stats.mode.length > 0 ? stats.mode.join(", ") : "N/A"}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Probability Distribution</h2>
              <div className="h-[400px]">
                <Chart
                  type="bar"
                  data={chartData}
                  options={chartOptions as any}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}