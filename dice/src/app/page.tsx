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
  }, [shouldCompute, computeDistribution, useMonteCarlo]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-200/60 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                Dice probability explorer
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                🎲 Dice Visualizer
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                Visualize outcome distributions for CoC and DnD rolls with exact combinatorics or Monte Carlo simulation.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[360px]">
              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
                <div className="text-xs uppercase tracking-wide text-slate-300">Method</div>
                <div className="mt-1 text-sm font-semibold">{useMonteCarlo ? "Monte Carlo" : "Exact"}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Operation</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{operation}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Min</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{distribution.length ? stats.min : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Max</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{distribution.length ? stats.max : "--"}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6 xl:sticky xl:top-6 xl:self-start">
            <div className="space-y-5">
              <div>
                <label htmlFor="diceExpression" className="mb-2 block text-sm font-semibold text-slate-800">
                  Dice expression
                </label>
                <p className="mb-3 text-xs leading-5 text-slate-500">
                  Use XdY notation. Multiple parts can be combined with +, -, * or /. Example: <span className="font-medium text-slate-700">2d6+1d8+3</span>
                </p>
                <input
                  id="diceExpression"
                  type="text"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="e.g. 1d6, 2d10+1d4, 4d6"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">Operation</label>
                  <select
                    value={operation}
                    onChange={(e) => setOperation(e.target.value as "sum" | "min" | "max")}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    title="Choose how to combine multiple dice"
                  >
                    <option value="sum">Sum</option>
                    <option value="min">Disadvantage / Min</option>
                    <option value="max">Advantage / Max</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMonteCarlo}
                      onChange={(e) => setUseMonteCarlo(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-blue-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">Monte Carlo simulation</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {useMonteCarlo ? "Approximate probabilities from repeated simulation." : "Disabled. Exact distribution mode is active."}
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {useMonteCarlo && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">Simulations</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={numSimulations}
                      onChange={(e) => setNumSimulations(parseInt(e.target.value) || 1000)}
                      min="100"
                      max="1000000"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      title="Number of simulations to run"
                    />
                    <span className="text-xs text-slate-500">runs</span>
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-slate-900 p-4 text-white">
                <div className="text-xs uppercase tracking-wide text-slate-400">Execution</div>
                <div className="mt-2 text-sm text-slate-200">
                  {useMonteCarlo
                    ? "Results refresh automatically when inputs change."
                    : "Exact mode computes on demand to avoid unnecessary heavy recomputation."}
                </div>
                {!useMonteCarlo && (
                  <button
                    onClick={() => setShouldCompute(true)}
                    disabled={loading}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {loading ? "Computing..." : "Compute exact distribution"}
                  </button>
                )}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Minimum</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.min : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Maximum</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.max : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Mean</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.mean : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Median</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.median : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Std. dev.</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.stdDev : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Expected</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.expected : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Outcomes</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.totalOutcomes.toLocaleString() : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Mode</div>
                <div className="mt-2 break-words text-lg font-bold text-slate-900">{distribution.length ? (stats.mode.length > 0 ? stats.mode.join(", ") : "N/A") : "--"}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/40 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Probability distribution</h2>
                  <p className="text-sm text-slate-500">
                    {useMonteCarlo ? "Approximate probabilities from simulation." : "Exact probabilities from combinatorial evaluation."}
                  </p>
                </div>
              </div>
              <div className="h-[320px] sm:h-[420px] xl:h-[520px]">
                <Chart
                  type="bar"
                  data={chartData}
                  options={chartOptions}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}