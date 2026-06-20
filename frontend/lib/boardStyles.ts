// Board & Piece style mappings for react-chessboard
import React from "react";

export type BoardStyle = "classic" | "wood" | "neon";
export type PieceStyle = "standard" | "neo" | "classic";

// ─── Board Square Colors ────────────────────────────────────────
export const BOARD_COLORS: Record<
  BoardStyle,
  { dark: string; light: string }
> = {
  classic: {
    dark: "#b58863",
    light: "#f0d9b5",
  },
  wood: {
    dark: "#5d3a1a",
    light: "#deb887",
  },
  neon: {
    dark: "#7e22ce",
    light: "#f3e8ff",
  },
};

// ─── Piece Renderer (Unicode pieces with style variants) ───────
type PieceKey =
  | "wP"
  | "wN"
  | "wB"
  | "wR"
  | "wQ"
  | "wK"
  | "bP"
  | "bN"
  | "bB"
  | "bR"
  | "bQ"
  | "bK";

const PIECE_UNICODE: Record<PieceKey, string> = {
  wP: "♙",
  wN: "♘",
  wB: "♗",
  wR: "♖",
  wQ: "♕",
  wK: "♔",
  bP: "♟",
  bN: "♞",
  bB: "♝",
  bR: "♜",
  bQ: "♛",
  bK: "♚",
};

const PIECE_COLOR = (piece: string) =>
  piece.startsWith("w") ? "#fff" : "#1a1a1a";

interface PieceProps {
  piece: string;
  squareWidth: number;
  squareHeight: number;
  isDragging: boolean;
}

function renderPiece(
  style: PieceStyle,
  { piece, squareWidth, squareHeight, isDragging }: PieceProps
): React.ReactElement {
  const char = PIECE_UNICODE[piece as PieceKey] ?? "";
  const fontSize = squareWidth * 0.78;
  const color = PIECE_COLOR(piece);

  if (style === "standard") {
    // Clean minimal look
    return React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize,
          color,
          fontWeight: 500,
          textShadow: piece.startsWith("w")
            ? "0 1px 2px rgba(0,0,0,0.4)"
            : "0 1px 2px rgba(255,255,255,0.15)",
          userSelect: "none",
          transition: isDragging ? "none" : "transform 0.1s",
          cursor: isDragging ? "grabbing" : "pointer",
        },
      },
      char
    );
  }

  if (style === "neo") {
    // Glowing neon style
    const glow = piece.startsWith("w")
      ? "0 0 12px rgba(168,85,247,0.6), 0 0 4px rgba(255,255,255,0.5)"
      : "0 0 8px rgba(0,0,0,0.6), 0 0 2px rgba(168,85,247,0.4)";
    return React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize,
          color,
          fontWeight: 700,
          textShadow: glow,
          filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.3))`,
          userSelect: "none",
          transition: isDragging ? "none" : "transform 0.1s",
          cursor: isDragging ? "grabbing" : "pointer",
        },
      },
      char
    );
  }

  // classic — outlined, traditional feel
  const outline = piece.startsWith("w")
    ? "0 1px 0 rgba(0,0,0,0.5), 0 -1px 0 rgba(0,0,0,0.2), 1px 0 0 rgba(0,0,0,0.2), -1px 0 0 rgba(0,0,0,0.2)"
    : "0 1px 0 rgba(255,255,255,0.15), 0 -1px 0 rgba(255,255,255,0.08), 1px 0 0 rgba(255,255,255,0.08), -1px 0 0 rgba(255,255,255,0.08)";
  return React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        color,
        fontWeight: 600,
        textShadow: outline,
        userSelect: "none",
        transition: isDragging ? "none" : "transform 0.1s",
        cursor: isDragging ? "grabbing" : "pointer",
      },
    },
    char
  );
}

export function createCustomPieces(style: PieceStyle) {
  return (args: PieceProps): React.ReactElement => renderPiece(style, args);
}
