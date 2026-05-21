"use client";

import React, { useMemo } from "react";
import type { StockfishEval } from "@/hooks/useStockfish";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvaluationBarProps {
  /** Kết quả từ hook useStockfish. Nếu không truyền thì hiển thị trạng thái neutral. */
  evaluation?: StockfishEval | null;
  /** Góc nhìn của bàn cờ — "white" (trắng ở dưới) hoặc "black" (đen ở dưới) */
  orientation?: "white" | "black";
  /** Chiều cao thanh — khớp với chiều cao bàn cờ. Mặc định 480px */
  height?: number | string;
  /** Chiều rộng thanh. Mặc định 24px */
  width?: number | string;
  className?: string;
}

// ── Conversion ────────────────────────────────────────────────────────────────

/**
 * Chuyển điểm centipawn → tỷ lệ phần trăm % cho phần Trắng (0–100).
 *
 * Logic:
 *  - Dùng hàm sigmoid để các lợi thế nhỏ vẫn hiển thị rõ ràng.
 *  - +500cp (5 quân) → ~100%, -500cp → ~0%
 *  - Nếu |score| ≥ 500cp → kịch trần
 */
function cpToWhitePercent(cp: number): number {
  // Giới hạn ở ±500 cp (±5 quân)
  const capped = Math.max(-500, Math.min(500, cp));
  // Sigmoid scale: sigmoid(x/250) * 100 → smooth, không tuyến tính
  const sigmoid = 1 / (1 + Math.exp(-capped / 180));
  // Ánh xạ 0–1 → 8–92 để không bao giờ chạm kịch trần (trừ mate)
  return 8 + sigmoid * 84;
}

/**
 * Định dạng nhãn điểm số hiển thị trên thanh.
 * Ví dụ: +1.40, -0.75, M3, -M5
 */
function formatEvalLabel(evaluation: StockfishEval): string {
  if (evaluation.mate !== null) {
    const m = evaluation.mate;
    return m > 0 ? `M${m}` : `-M${Math.abs(m)}`;
  }
  const pawns = evaluation.score / 100;
  const abs = Math.abs(pawns);
  const sign = pawns >= 0 ? "+" : "-";
  return `${sign}${abs.toFixed(2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EvaluationBar({
  evaluation,
  orientation = "white",
  height = 480,
  width = 24,
  className = "",
}: EvaluationBarProps) {
  // ── Tính toán tỷ lệ fill ───────────────────────────────────────────────────
  const whitePercent = useMemo(() => {
    if (!evaluation) return 50; // Neutral khi chưa có dữ liệu

    // Chiếu bí → kịch trần
    if (evaluation.mate !== null) {
      return evaluation.mate > 0 ? 100 : 0;
    }

    const score = evaluation.score;
    // ±500cp trở lên → kịch trần theo yêu cầu
    if (score >= 500) return 100;
    if (score <= -500) return 0;
    return cpToWhitePercent(score);
  }, [evaluation]);

  // Nếu bàn cờ lật (orientation=black), lật cả thanh
  // Thanh luôn render: phần trên = màu hiện tại "phía trên", phần dưới = "phía dưới"
  const topPercent = orientation === "white"
    ? 100 - whitePercent   // phần đen ở trên
    : whitePercent;         // phần trắng ở trên

  const bottomPercent = 100 - topPercent;

  // Màu cho 2 phần
  const topColor    = orientation === "white" ? "#1c1c2e" : "#f5f0e8";
  const bottomColor = orientation === "white" ? "#f5f0e8" : "#1c1c2e";

  // Label điểm số
  const label = evaluation ? formatEvalLabel(evaluation) : "0.00";

  // Bên nào đang có lợi để chọn màu chữ label
  const whiteAdvantage = whitePercent >= 50;

  // Indicator đang tính toán
  const isCalculating = evaluation?.isCalculating ?? false;

  const heightPx = typeof height === "number" ? `${height}px` : height;
  const widthPx  = typeof width  === "number" ? `${width}px`  : width;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {/* ── Điểm số (phía trên) ───────────────────────────────────────────── */}
      <div
        title={isCalculating ? "Đang phân tích..." : "Đánh giá thế cờ"}
        style={{
          fontSize: "10px",
          fontWeight: 700,
          fontFamily: "'Roboto Mono', 'Courier New', monospace",
          color: whiteAdvantage ? "#f5f0e8" : "#9ca3af",
          letterSpacing: "0.04em",
          minWidth: widthPx,
          textAlign: "center",
          padding: "2px 0",
          opacity: isCalculating ? 0.6 : 1,
          transition: "opacity 0.3s",
        }}
      >
        {label}
      </div>

      {/* ── Thanh chính ───────────────────────────────────────────────────── */}
      <div
        style={{
          width: widthPx,
          height: heightPx,
          borderRadius: "6px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: bottomColor,
        }}
      >
        {/* Phần trên (đen hoặc trắng tuỳ orientation) */}
        <div
          style={{
            height: `${topPercent}%`,
            background: topColor,
            transition: "height 0.55s cubic-bezier(0.34, 1.10, 0.64, 1)",
            flexShrink: 0,
            position: "relative",
          }}
        >
          {/* Highlight mép dưới của phần trên để trông như đường phân cách */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "1.5px",
              background: "rgba(168, 85, 247, 0.55)",
              boxShadow: "0 0 4px rgba(168, 85, 247, 0.6)",
              opacity: topPercent > 2 && topPercent < 98 ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          />
        </div>

        {/* Đường giữa cố định (vị trí 50%) */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: "1px",
            background: "rgba(168,85,247,0.2)",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />

        {/* Pulse khi đang tính toán */}
        {isCalculating && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, transparent 40%, rgba(168,85,247,0.07) 100%)",
              animation: "evalPulse 1.5s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* ── Badge W / B ───────────────────────────────────────────────────── */}
      <div
        style={{
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: whiteAdvantage ? "rgba(245,240,232,0.6)" : "rgba(156,163,175,0.6)",
          textAlign: "center",
          minWidth: widthPx,
          transition: "color 0.5s",
        }}
      >
        {evaluation?.mate !== null && evaluation?.mate
          ? evaluation.mate > 0 ? "W♔" : "B♚"
          : whitePercent === 50 ? "=" : whiteAdvantage ? "W" : "B"}
      </div>

      {/* ── CSS animation ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes evalPulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
