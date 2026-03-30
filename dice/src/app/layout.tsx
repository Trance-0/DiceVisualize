import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dice Visualizer - Probability Visualization for CoC & DnD",
  description: "A dice probability visualization site for Call of Cthulhu & Dungeons & Dragons dice. Analyze the distribution of dice rolls with Monte Carlo simulation and exact combinatorial calculations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}