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
  const sanitized = expression.replace(/\s+/g, "");

  if (sanitized.includes("/")) {
    throw new Error("Division is not supported.");
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

function getMonteCarloDistribution(diceRolls: DiceRoll[], numSimulations: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < numSimulations; i++) {
    let current = 0;
    for (const roll of diceRolls) {
      for (let j = 0; j < roll.trial; j++) {
        current += Math.floor(Math.random() * roll.sides) + 1;
      }
    }
    results.push(current);
  }
  return results;
}

function getExactDistribution(diceRolls: DiceRoll[]): number[] {
  let results: number[] = [0];
  for (const roll of diceRolls) {
    for (let i = 0; i < roll.trial; i++) {
      const aug: number[] = [];
      for (let j = 0; j < roll.sides; j++) {
        aug.push(j + 1);
      }
      results = results.flatMap((x) => aug.map((y) => x + y));
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
      mode: [] as number[],
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

  const freq: Record<number, number> = {};
  distribution.forEach((x) => {
    freq[x] = (freq[x] || 0) + 1;
  });
  const maxFreq = Math.max(...Object.values(freq));
  const mode = Object.keys(freq)
    .filter((k) => freq[parseInt(k, 10)] === maxFreq)
    .map((k) => parseInt(k, 10));

  const variance = distribution.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / distribution.length;
  const stdDev = Math.sqrt(variance);

  return {
    min,
    max,
    mean: Number(mean.toFixed(2)),
    expected: Number(expected.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    mode: mode.length === distribution.length ? [] : mode,
    totalOutcomes: distribution.length,
  };
}

export default function Home() {
  const [expression, setExpression] = useState("1d6");
  const [numSimulations, setNumSimulations] = useState(1000);
  const [distribution, setDistribution] = useState<number[]>([]);
  const [error, setError] = useState<string>("");
  const [useMonteCarlo, setUseMonteCarlo] = useState(true);
  const [shouldCompute, setShouldCompute] = useState(false);
  const [loading, setLoading] = useState(false);

  const computeDistribution = useCallback(() => {
    try {
      setLoading(true);
      const diceRolls = parseDiceExpression(expression);
      const results = useMonteCarlo
        ? getMonteCarloDistribution(diceRolls, numSimulations)
        : getExactDistribution(diceRolls);
      setDistribution(results);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid dice expression. Use format like '1d6' or '2d10+1d4'.");
    } finally {
      setLoading(false);
    }
  }, [expression, numSimulations, useMonteCarlo]);

  useEffect(() => {
    if (useMonteCarlo || shouldCompute) {
      computeDistribution();
      setShouldCompute(false);
    }
  }, [expression, numSimulations, useMonteCarlo, shouldCompute, computeDistribution]);

  const stats = calculateStats(distribution);

  const chartData: ChartData<"bar"> = {
    labels: Array.from({ length: stats.max - stats.min + 1 }, (_, i) => i + stats.min),
    datasets: [
      {
        label: useMonteCarlo ? "Estimated Probability" : "Exact Probability",
        data: Array.from({ length: stats.max - stats.min + 1 }, (_, i) => {
          const value = i + stats.min;
          const count = distribution.filter((x) => x === value).length;
          return distribution.length ? count / distribution.length : 0;
        }),
        backgroundColor: "rgba(37, 99, 235, 0.72)",
        borderColor: "rgba(29, 78, 216, 1)",
        borderWidth: 1,
        borderRadius: 8,
        hoverBackgroundColor: "rgba(59, 130, 246, 0.85)",
      },
    ],
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
          font: { size: 12 },
        },
        ticks: {
          color: "#64748b",
        },
        grid: {
          color: "#e2e8f0",
        },
      },
      x: {
        title: {
          display: true,
          text: "Result",
          font: { size: 12 },
        },
        ticks: {
          color: "#64748b",
        },
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "#334155",
          font: { size: 12 },
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 10,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                Dice probability explorer
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">🎲 Dice Visualizer</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Analyze dice sums for tabletop systems with an exact combinatorial method or a fast Monte Carlo estimate.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
                <div className="text-xs uppercase tracking-wide text-slate-300">Method</div>
                <div className="mt-1 text-sm font-semibold">{useMonteCarlo ? "Monte Carlo" : "Exact"}</div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Input</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{expression}</div>
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

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6 xl:sticky xl:top-6 xl:self-start">
            <div className="space-y-5">
              <div>
                <label htmlFor="diceExpression" className="mb-2 block text-sm font-semibold text-slate-800">
                  Dice expression
                </label>
                <p className="mb-3 text-xs leading-5 text-slate-500">
                  Use XdY notation and combine terms with <span className="font-medium text-slate-700">+</span> only. Division is disabled. Example: <span className="font-medium text-slate-700">2d6+1d8+3</span>
                </p>
                <input
                  id="diceExpression"
                  type="text"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="e.g. 1d6 or 2d10+1d4"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMonteCarlo}
                    onChange={(e) => setUseMonteCarlo(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Use Monte Carlo simulation</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {useMonteCarlo ? "Fast approximate probabilities from repeated sampling." : "Disabled. Exact computation is active."}
                    </span>
                  </span>
                </label>
              </div>

              {useMonteCarlo && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">Simulations</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={numSimulations}
                      onChange={(e) => setNumSimulations(parseInt(e.target.value, 10) || 1000)}
                      min="100"
                      max="1000000"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                    <span className="text-xs text-slate-500">runs</span>
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-slate-900 p-4 text-white">
                <div className="text-xs uppercase tracking-wide text-slate-400">Execution</div>
                <div className="mt-2 text-sm text-slate-200">
                  {useMonteCarlo
                    ? "Distribution updates automatically while editing."
                    : "Exact mode runs on demand to avoid expensive recomputation."}
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
                <div className="text-xs uppercase tracking-wide text-slate-500">Expected</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.expected : "--"}</div>
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
                <div className="text-xs uppercase tracking-wide text-slate-500">Outcomes</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{distribution.length ? stats.totalOutcomes.toLocaleString() : "--"}</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs uppercase tracking-wide text-slate-500">Mode</div>
                <div className="mt-2 break-words text-lg font-bold text-slate-900">
                  {distribution.length ? (stats.mode.length > 0 ? stats.mode.join(", ") : "N/A") : "--"}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/40 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Probability distribution</h2>
                  <p className="text-sm text-slate-500">
                    {useMonteCarlo ? "Estimated distribution from simulation." : "Exact distribution from full combinatorial enumeration."}
                  </p>
                </div>
              </div>
              <div className="h-[320px] sm:h-[420px] xl:h-[520px]">
                <Chart type="bar" data={chartData} options={chartOptions} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
