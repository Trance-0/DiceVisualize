"use client";

import { useState, useEffect } from "react";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DiceRoll {
  // current value of computation, default is [0], if need to be compute, then set to empty list.
  trial: number;
  sides: number;
}

function parseDiceExpression(expression: string): DiceRoll[] {
  const parseNode = (expr: string): DiceRoll => {
    if(expr.includes("d")) {
      const match = expr.match(/^(\d+)d(\d+)$/);
      if (!match) {
        throw new Error("Invalid base dice expression. Use format like '1d6' or constant '1'");
      }
      return {
        trial: parseInt(match[1]),
        sides: parseInt(match[2])
      };
    } else {
      return {
        trial: parseInt(expr),
        sides: 1
      };
    }
  }
  // Remove all whitespace
  const components = expression.split("+");
  const diceRolls: DiceRoll[] = [];
  for (const component of components) {
    diceRolls.push(parseNode(component));
  };
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
      results = results.flatMap(x => aug.map(y => x + y));
    }
  }
  return results;
}

export default function Home() {
  const [expression, setExpression] = useState("1d6");
  const [numSimulations, setNumSimulations] = useState(1000);
  const [operation, setOperation] = useState<"sum" | "min" | "max">("sum");
  const [distribution, setDistribution] = useState<number[]>([]);
  const [error, setError] = useState<string>("");
  const [useMonteCarlo, setUseMonteCarlo] = useState(true);
  const [shouldCompute, setShouldCompute] = useState(false);

  const computeDistribution = () => {
    try {
      const diceRolls = parseDiceExpression(expression);
      const results = useMonteCarlo 
        ? getMonteCarloDistribution(diceRolls, numSimulations)
        : getExactDistribution(diceRolls);
      setDistribution(results);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid dice expression. Use format like '1d6' or '2d10+1d4'");
    }
  };

  useEffect(() => {
    if (useMonteCarlo || shouldCompute) {
      computeDistribution();
      setShouldCompute(false);
    }
  }, [expression, numSimulations, operation, useMonteCarlo, shouldCompute]);

  const stats = {
    min: distribution.length ? Math.min(...distribution) : 0,
    max: distribution.length ? Math.max(...distribution) : 0,
    mean: distribution.length ? distribution.reduce((a, b) => a + b, 0) / distribution.length : 0,
    expected: distribution.length ? distribution.reduce((a, b) => a + b, 0) / distribution.length : 0
  };

  const chartData = {
    labels: Array.from({length: stats.max - stats.min + 1}, (_, i) => i + stats.min),
    datasets: [{
      label: "Probability",
      data: (useMonteCarlo ? Array.from({length: stats.max - stats.min + 1}, (_, i) => 
        distribution.filter(x => x === i + stats.min).length / numSimulations
      ) : Array.from({length: stats.max - stats.min + 1}, (_, i) => 
        distribution.filter(x => x === i + stats.min).length / distribution.length
      )),
      backgroundColor: "rgba(75, 192, 192, 0.6)",
    }]
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dice Probability Visualizer</h1>
        
        <div className="grid gap-4 mb-8">
          <div className="flex flex-col gap-2">
            <label htmlFor="diceExpression" className="text-sm font-medium text-gray-700">
              Dice Expression
            </label>
            <div className="text-xs text-gray-500">
              Enter dice expression in format: XdY where X is number of dice and Y is number of sides. Multiple dice can be added with + operator. Other operators is not supported yet.
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  id="diceExpression"
                  type="text"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="e.g., 1d6, 2d10+1d4, (2d6+1d4)*2"
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
                  onChange={(e) => setNumSimulations(parseInt(e.target.value))}
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
          
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Min</div>
              <div className="text-xl font-bold">{stats.min}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Max</div>
              <div className="text-xl font-bold">{stats.max}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Mean</div>
              <div className="text-xl font-bold">{stats.mean.toFixed(2)}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Expected</div>
              <div className="text-xl font-bold">{stats.expected.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="h-96">
          <Chart
            type="bar"
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: "Frequency"
                  }
                },
                x: {
                  title: {
                    display: true,
                    text: "Result"
                  }
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
