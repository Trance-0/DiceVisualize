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
  multiplier: number;
  sides: number|DiceRoll[];
  // the modifier after the dice roll node, default is +
  modifier?: "+" | "-" | "*" | "/";
}

function parseDiceExpression(expression: string): DiceRoll {
  // Remove all whitespace
  expression = expression.replace(/\s+/g, '');
  // filling up 1d before all the parentheses
  expression = expression.replace(/\(/g, "1d(");
  expression = expression.replace(/\)/g, ")");
  
  const parseNode = (expr: string): DiceRoll => {
    const match = expr.match(/^(\d+)(d\d+)(.*)$/);
    if (!match) {
      throw new Error("Invalid dice expression. Use format like '1d6' or '2d10+1d4'");
    }
    return {
      multiplier: parseInt(match[1]),
      sides: parseInt(match[2]),
      modifier: match[3] as "+" | "-" | "*" | "/" || "+"
    };
  };
  return parseNode(expression);
}

function getMonteCarloDistribution(node: DiceRoll, numSimulations: number): number[] {
  const results: number[] = [];
  
  const evaluateNode = (node: DiceRoll): number => {
    if (node.type === "roll") {
      const roll = node.value!;
      return Array(roll.count)
        .fill(0)
        .map(() => Math.floor(Math.random() * roll.sides) + 1)
        .reduce((sum, val) => sum + val, 0);
    } else {
      const left = evaluateNode(node.left!);
      const right = evaluateNode(node.right!);
      switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return left / right;
        default: throw new Error("Invalid operator");
      }
    }
  };

  for (let i = 0; i < numSimulations; i++) {
    results.push(evaluateNode(node));
  }
  
  return results;
}

function getExactDistribution(node: DiceRoll): number[] {
  const results: number[] = [];
  
  const evaluateNode = (node: DiceRoll): number[] => {
    if (node.type === "roll") {
      const roll = node.value!;
      const outcomes: number[] = [];
      for (let i = 0; i < roll.count; i++) {
        const sides = roll.sides;
        const weights = Array(sides).fill(1/sides);
        outcomes.push(...weights);
      }
      return outcomes;
    } else {
      const left = evaluateNode(node.left!);
      const right = evaluateNode(node.right!);
      const combined: number[] = [];
      
      for (const l of left) {
        for (const r of right) {
          let result: number;
          switch (node.operator) {
            case "+": result = l + r; break;
            case "-": result = l - r; break;
            case "*": result = l * r; break;
            case "/": result = l / r; break;
            default: throw new Error("Invalid operator");
          }
          combined.push(result);
        }
      }
      return combined;
    }
  };

  return evaluateNode(node);
}

export default function Home() {
  const [expression, setExpression] = useState("1d6");
  const [numRolls, setNumRolls] = useState(1);
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
      setError("Invalid dice expression. Use format like '1d6' or '2d10+1d4'");
    }
  };

  useEffect(() => {
    if (useMonteCarlo || shouldCompute) {
      computeDistribution();
      setShouldCompute(false);
    }
  }, [expression, numRolls, operation, useMonteCarlo, shouldCompute]);

  const stats = {
    min: distribution.length ? Math.min(...distribution) : 0,
    max: distribution.length ? Math.max(...distribution) : 0,
    mean: distribution.length ? distribution.reduce((a, b) => a + b, 0) / distribution.length : 0,
    expected: distribution.length ? distribution.reduce((a, b) => a + b, 0) / distribution.length : 0
  };

  const chartData = {
    labels: Array.from({length: stats.max - stats.min + 1}, (_, i) => i + stats.min),
    datasets: [{
      label: "Frequency",
      data: Array.from({length: stats.max - stats.min + 1}, (_, i) => 
        distribution.filter(x => x === i + stats.min).length
      ),
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
              Enter dice expression in format: XdY where X is number of dice and Y is number of sides. Multiple dice can be added with +,-,*,/ or grouped with parentheses
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
                <option value="sum">Sum</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
              </select>
              <input
                type="number"
                value={numRolls}
                onChange={(e) => setNumRolls(parseInt(e.target.value))}
                min="1"
                max="10000"
                className="w-32 p-2 border rounded"
                title="Number of times to roll the dice"
              />
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
