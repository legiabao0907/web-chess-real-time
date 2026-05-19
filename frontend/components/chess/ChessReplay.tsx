"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Chess } from "chess.js";
import {
  SkipBack,
  ChevronLeft,
  ChevronRight,
  SkipForward,
} from "lucide-react";

// Lazy-load Chessboard so it never runs on the server
const Chessboard = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard as any),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VerboseMove {
  color: "w" | "b";
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  flags: string;
  san: string;
  lan?: string;
  before: string;
  after: string;
}

export interface ChessReplayProps {
  /** Full verbose move list from `GET /game/:id/history` */
  moves: VerboseMove[];
  /** Board orientation — "white" | "black" */
  orientation?: "white" | "black";
  /** Optional size override (CSS value, default "min(520px, 100%)") */
  boardSize?: string;
  /** Fallback FEN — shown when moves array is empty (legacy games) */
  finalFen?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Rebuild the FEN for position AFTER move at `index`.
 * index === -1 → starting position.
 */
function fenAtIndex(moves: VerboseMove[], index: number): string {
  const chess = new Chess();
  for (let i = 0; i <= index; i++) {
    chess.move({
      from: moves[i].from,
      to: moves[i].to,
      promotion: moves[i].promotion,
    });
  }
  return chess.fen();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChessReplay({
  moves,
  orientation = "white",
  boardSize = "min(520px, 100%)",
  finalFen,
}: ChessReplayProps) {
  /**
   * currentMoveIndex:
   *   -1  → starting position (board empty of moves, i.e. initial)
   *    0  → position after move 0
   *   N-1 → final position
   */
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const moveListRef = useRef<HTMLDivElement>(null);

  // ── Derived FEN ─────────────────────────────────────────────────────────────
  const displayFen = useMemo(() => {
    // No moves at all — show finalFen if provided, else starting position
    if (moves.length === 0) {
      return finalFen ?? new Chess().fen();
    }
    if (currentMoveIndex === -1) {
      return new Chess().fen(); // starting position
    }
    try {
      return fenAtIndex(moves, currentMoveIndex);
    } catch {
      return finalFen ?? new Chess().fen();
    }
  }, [moves, currentMoveIndex, finalFen]);

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const goToStart = useCallback(() => setCurrentMoveIndex(-1), []);
  const goToEnd = useCallback(
    () => setCurrentMoveIndex(moves.length - 1),
    [moves.length]
  );
  const goBack = useCallback(
    () => setCurrentMoveIndex((i) => Math.max(-1, i - 1)),
    []
  );
  const goForward = useCallback(
    () => setCurrentMoveIndex((i) => Math.min(moves.length - 1, i + 1)),
    [moves.length]
  );

  const isAtStart = currentMoveIndex === -1;
  const isAtEnd = currentMoveIndex === moves.length - 1;

  // ── Keyboard navigation ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!moves.length) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          goForward();
          break;
        case "ArrowUp":
        case "Home":
          e.preventDefault();
          goToStart();
          break;
        case "ArrowDown":
        case "End":
          e.preventDefault();
          goToEnd();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [moves.length, goBack, goForward, goToStart, goToEnd]);

  // ── Auto-scroll active move into view ───────────────────────────────────────
  useEffect(() => {
    if (!moveListRef.current) return;
    const active = moveListRef.current.querySelector<HTMLElement>(
      "[data-active='true']"
    );
    if (active) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentMoveIndex]);

  // ── Move list (pair rows: white + black) ─────────────────────────────────────
  const moveRows = useMemo(() => {
    const rows: {
      turn: number;
      white: VerboseMove | null;
      black: VerboseMove | null;
      whiteIdx: number;
      blackIdx: number | null;
    }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      rows.push({
        turn: Math.floor(i / 2) + 1,
        white: moves[i] ?? null,
        black: moves[i + 1] ?? null,
        whiteIdx: i,
        blackIdx: moves[i + 1] != null ? i + 1 : null,
      });
    }
    return rows;
  }, [moves]);

  // ── Label ────────────────────────────────────────────────────────────────────
  const positionLabel =
    currentMoveIndex === -1
      ? "Start"
      : currentMoveIndex === moves.length - 1
      ? "Final"
      : `Move ${currentMoveIndex + 1} / ${moves.length}`;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* ── Board column ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        {/* Board */}
        <div style={{ width: boardSize, aspectRatio: "1", position: "relative" }}>
          {typeof window !== "undefined" && (
            <Chessboard
              position={displayFen}
              arePiecesDraggable={false}
              animationDuration={120}
              boardOrientation={orientation}
              customBoardStyle={{
                borderRadius: "10px",
                boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
              }}
              customDarkSquareStyle={{ backgroundColor: "#4a3728" }}
              customLightSquareStyle={{ backgroundColor: "#f0c080" }}
            />
          )}
        </div>

        {/* Navigation controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "14px",
            padding: "8px 18px",
          }}
        >
          {/* |< To Start */}
          <NavBtn onClick={goToStart} disabled={isAtStart} title="Về đầu (Home)">
            <SkipBack size={15} />
          </NavBtn>

          {/* < Back */}
          <NavBtn onClick={goBack} disabled={isAtStart} title="Lùi 1 nước (←)">
            <ChevronLeft size={18} />
          </NavBtn>

          {/* Position label */}
          <span
            style={{
              minWidth: "96px",
              textAlign: "center",
              fontSize: "0.78rem",
              color: "rgba(255,255,255,0.5)",
              fontVariantNumeric: "tabular-nums",
              userSelect: "none",
            }}
          >
            {positionLabel}
          </span>

          {/* > Forward */}
          <NavBtn onClick={goForward} disabled={isAtEnd} title="Tiến 1 nước (→)">
            <ChevronRight size={18} />
          </NavBtn>

          {/* >| To End */}
          <NavBtn onClick={goToEnd} disabled={isAtEnd} title="Đến cuối (End)">
            <SkipForward size={15} />
          </NavBtn>
        </div>

        {/* Keyboard hint */}
        <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", margin: 0, userSelect: "none" }}>
          ← → Arrow keys · Home / End to jump
        </p>
      </div>

      {/* ── Move list column ─────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: "200px",
          maxWidth: "260px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          Move History
        </div>

        {/* Scrollable list */}
        <div
          ref={moveListRef}
          style={{ overflowY: "auto", flex: 1, padding: "6px", maxHeight: "420px" }}
        >
          {/* Starting position row */}
          <div
            data-active={currentMoveIndex === -1 ? "true" : "false"}
            onClick={() => setCurrentMoveIndex(-1)}
            style={{
              display: "flex",
              padding: "3px 6px",
              borderRadius: "6px",
              cursor: "pointer",
              marginBottom: "2px",
              background:
                currentMoveIndex === -1
                  ? "rgba(168,85,247,0.2)"
                  : "transparent",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              if (currentMoveIndex !== -1)
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              if (currentMoveIndex !== -1)
                e.currentTarget.style.background = "transparent";
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                color:
                  currentMoveIndex === -1
                    ? "#a855f7"
                    : "rgba(255,255,255,0.4)",
                fontStyle: "italic",
              }}
            >
              Start position
            </span>
          </div>

          {moveRows.map((row) => (
            <div
              key={row.turn}
              style={{
                display: "flex",
                padding: "2px 4px",
                borderRadius: "6px",
                fontSize: "0.85rem",
                gap: "2px",
              }}
            >
              {/* Turn number */}
              <span
                style={{
                  width: "26px",
                  color: "rgba(255,255,255,0.28)",
                  flexShrink: 0,
                  fontSize: "0.78rem",
                  lineHeight: "1.8",
                }}
              >
                {row.turn}.
              </span>

              {/* White move */}
              <MoveChip
                san={row.white?.san ?? ""}
                isActive={currentMoveIndex === row.whiteIdx}
                onClick={() => setCurrentMoveIndex(row.whiteIdx)}
              />

              {/* Black move */}
              {row.black ? (
                <MoveChip
                  san={row.black.san}
                  isActive={
                    row.blackIdx !== null &&
                    currentMoveIndex === row.blackIdx
                  }
                  onClick={() =>
                    row.blackIdx !== null &&
                    setCurrentMoveIndex(row.blackIdx)
                  }
                />
              ) : (
                <span style={{ flex: 1 }} />
              )}
            </div>
          ))}

          {moves.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "2rem",
                color: "rgba(255,255,255,0.2)",
                fontSize: "0.8rem",
              }}
            >
              No moves recorded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface NavBtnProps {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}

function NavBtn({ onClick, disabled, title, children }: NavBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "7px",
        borderRadius: "8px",
        background: "none",
        border: "none",
        color: disabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.65)",
        cursor: disabled ? "default" : "pointer",
        transition: "color 0.2s, background 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = "white";
          e.currentTarget.style.background = "rgba(168,85,247,0.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = disabled
          ? "rgba(255,255,255,0.18)"
          : "rgba(255,255,255,0.65)";
        e.currentTarget.style.background = "none";
      }}
    >
      {children}
    </button>
  );
}

interface MoveChipProps {
  san: string;
  isActive: boolean;
  onClick: () => void;
}

function MoveChip({ san, isActive, onClick }: MoveChipProps) {
  return (
    <span
      data-active={isActive ? "true" : "false"}
      onClick={onClick}
      style={{
        flex: 1,
        padding: "2px 7px",
        borderRadius: "5px",
        cursor: "pointer",
        fontWeight: 600,
        transition: "background 0.15s, color 0.15s",
        background: isActive ? "rgba(168,85,247,0.28)" : "transparent",
        color: isActive ? "#c084fc" : "rgba(255,255,255,0.82)",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      {san}
    </span>
  );
}
