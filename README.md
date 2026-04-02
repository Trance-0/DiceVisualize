# Dice Visualizer

A dice probability visualization site for Call of Cthulhu and Dungeons & Dragons dice. It helps analyze probability distributions for common RPG rolls and modifiers.

## Features

- **Dice Expression Parsing**
  - Single dice: `1d6`, `2d10`, `4d20`
  - Multiple dice: `1d6 + 1d8`, `2d6 + 3d4`
  - Constants: `10`, `15`

- **Advanced Operations**
  - Sum (default)
  - Disadvantage / minimum-style evaluation
  - Advantage / maximum-style evaluation

- **Two Calculation Methods**
  - **Monte Carlo simulation** for fast approximate probabilities
  - **Exact combinatorial calculation** for precise probabilities

- **Comprehensive Statistics**
  - Minimum / maximum
  - Mean
  - Median
  - Standard deviation
  - Expected value
  - Mode
  - Total possible outcomes

- **Interactive Visualization**
  - Probability distribution chart
  - Responsive layout
  - Color-coded stats

## Problem Context

When playing CoC or DnD, players often need to reason about the sum of several dice and modifiers. Humans are poor at doing that quickly in their head. This project visualizes those distributions directly.

## Technical Stack

- Next.js 15.3.1
- React 19
- Chart.js 4.4.9
- react-chartjs-2
- TypeScript 5

## Methods Used

### Monte Carlo Method

The Monte Carlo method uses random samples to approximate the target distribution. Here it serves as a practical validation method and as a fast estimator.

### Combinatorial Mathematics

The exact distribution of dice rolls can also be computed directly by enumeration and combinatorics.

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/Trance-0/DiceVisualize.git
   cd DiceVisualize
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:3000`

5. Build for production:
   ```bash
   npm run build
   npm start
   ```

## Usage Examples

### Basic Dice Roll
- Expression: `1d6`
- Mean: `3.5`
- Standard deviation: `~1.71`

### Advantage / Disadvantage Style Evaluation
- Expression: `2d6`
- Mean: `7`
- Standard deviation: `~2.42`
- Disadvantage: evaluate with minimum-style behavior
- Advantage: evaluate with maximum-style behavior

### Complex Expression
- Expression: `3d6 + 1d8 + 5`
- Mean: `19`

## Development

### Project Structure

```text
dice/
├── src/
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       └── globals.css
├── public/
├── package.json
├── tsconfig.json
└── next.config.ts
```

## License

MIT

## Contributing

Pull requests are welcome.
