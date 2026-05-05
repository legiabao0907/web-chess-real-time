"use client";

import React, { useMemo } from "react";

interface EvaluationBarProps {
  score: number; // centipawns, positive = white ahead
  orientation?: "white" | "black"; // board perspective
  isCheckmate?: boolean;
  className?: string;
}

/**
 * Converts centipawn score to a 0–100 percentage for White's fill.
 * Caps at ±15 pawns (1500 cp).
 */
function scoreToPercent(score: number): number {
  const capped = Math.max(-1500, Math.min(1500, score));
  // Sigmoid-like mapping so small advantages are visible
  return 50 + (capped / 1500) * 45;
}

function formatScore(score: number, isCheckmate: boolean): string {
  if (isCheckmate) return score > 0 ? "M" : "-M";
  const abs = Math.abs(score);
  if (abs >= 100) return `${(abs / 100).toFixed(1)}`;
  return `+${(abs / 100).toFixed(2)}`.replace("+", score >= 0 ? "+" : "-");
}

export default function EvaluationBar({
  score,
  orientation = "white",
  isCheckmate = false,
  className = "",
}: EvaluationBarProps) {
  const whitePercent = useMemo(() => {
    if (isCheckmate) return score > 0 ? 100 : 0;
    return scoreToPercent(score);
  }, [score, isCheckmate]);

  const blackPercent = 100 - whitePercent;

  // The bar is always rendered top=black, bottom=white
  // If orientation is black (flipped board), we flip the bar
  const topPercent = orientation === "white" ? blackPercent : whitePercent;
  const bottomPercent = orientation === "white" ? whitePercent : blackPercent;

  const topColor = orientation === "white" ? "#1a1a2e" : "#f0d9b5";
  const bottomColor = orientation === "white" ? "#f0d9b5" : "#1a1a2e";

  const advantage = score > 0 ? "white" : score < 0 ? "black" : "equal";
  const scoreLabel = isCheckmate
    ? score > 0
      ? "White wins"
      : "Black wins"
    : Math.abs(score) < 30
    ? "Equal"
    : score > 0
    ? `+${(Math.abs(score) / 100).toFixed(1)}`
    : `-${(Math.abs(score) / 100).toFixed(1)}`;

  return (
    <div
      className={`eval-bar-container ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        userSelect: "none",
      }}
    >
      {/* Score label */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: advantage === "white" ? "#f0d9b5" : advantage === "black" ? "#aaa" : "#888",
          letterSpacing: "0.03em",
          minWidth: "36px",
          textAlign: "center",
          fontFamily: "monospace",
        }}
      >
        {scoreLabel}
      </div>

      {/* Bar */}
      <div
        style={{
          width: "18px",
          height: "220px",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)",
          background: bottomColor,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        {/* Top half (black or white depending on orientation) */}
        <div
          style={{
            height: `${topPercent}%`,
            background: topColor,
            transition: "height 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            position: "relative",
          }}
        >
          {/* Checkmate indicator dot */}
          {isCheckmate && (
            <div
              style={{
                position: "absolute",
                bottom: "4px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: advantage === "white" ? "#f0d9b5" : "#1a1a2e",
              }}
            />
          )}
        </div>

        {/* Middle line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: "1px",
            background: "rgba(255,255,255,0.25)",
            transform: "translateY(-50%)",
          }}
        />
      </div>

      {/* Advantage badge */}
      <div
        style={{
          fontSize: "9px",
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          textAlign: "center",
        }}
      >
        {advantage === "white" ? "W" : advantage === "black" ? "B" : "="}
      </div>
    </div>
  );
}
