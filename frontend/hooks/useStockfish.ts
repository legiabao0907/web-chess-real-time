"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StockfishEval {
  /** Centipawns từ góc nhìn của bên đang đi (side to move).
   *  Đã chuẩn hóa: dương = Trắng có lợi, âm = Đen có lợi. */
  score: number;
  /** Nếu là chiếu bí: số nước còn lại (dương = Trắng thắng, âm = Đen thắng) */
  mate: number | null;
  /** Độ sâu hiện tại đang phân tích */
  depth: number;
  /** Engine đang tính toán hay đã xong */
  isCalculating: boolean;
}

const DEFAULT_EVAL: StockfishEval = {
  score: 0,
  mate: null,
  depth: 0,
  isCalculating: false,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKER_PATH = "/stockfish.js";
const ANALYSIS_DEPTH = 12;

// Debounce ms — tránh gửi quá nhiều lệnh khi FEN thay đổi nhanh
const DEBOUNCE_MS = 120;

// ── Parser ─────────────────────────────────────────────────────────────────────

/**
 * Parse một dòng UCI output từ Stockfish.
 * Ví dụ:
 *   "info depth 12 seldepth 18 score cp 45 nodes ..."
 *   "info depth 8 score mate 3 nodes ..."
 * Trả về null nếu không phải dòng "info score".
 */
function parseInfoLine(
  line: string,
  fenTurn: "w" | "b"
): Partial<StockfishEval> | null {
  if (!line.startsWith("info") || !line.includes("score")) return null;

  const depthMatch = line.match(/\bdepth (\d+)/);
  const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;

  // Chiếu bí
  const mateMatch = line.match(/\bscore mate (-?\d+)/);
  if (mateMatch) {
    const mateIn = parseInt(mateMatch[1], 10);
    // Chuẩn hóa về góc nhìn Trắng:
    // Nếu side-to-move = đen và mate dương → đen đang thắng → âm với Trắng
    const normalizedMate = fenTurn === "b" ? -mateIn : mateIn;
    return { mate: normalizedMate, score: normalizedMate > 0 ? 99999 : -99999, depth };
  }

  // Centipawn
  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  if (cpMatch) {
    const cp = parseInt(cpMatch[1], 10);
    // UCI trả về cp theo góc nhìn side-to-move, chuyển sang góc nhìn Trắng
    const normalizedCp = fenTurn === "b" ? -cp : cp;
    return { score: normalizedCp, mate: null, depth };
  }

  return null;
}

/**
 * Lấy side-to-move từ chuỗi FEN.
 * FEN field thứ 2 (0-indexed) là "w" hoặc "b".
 */
function getTurnFromFen(fen: string): "w" | "b" {
  const parts = fen.split(" ");
  return parts[1] === "b" ? "b" : "w";
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * `useStockfish`
 *
 * Quản lý toàn bộ vòng đời của Stockfish Web Worker.
 *
 * @param fen - Chuỗi FEN hiện tại. Hook sẽ tự động phân tích mỗi khi FEN thay đổi.
 * @param enabled - Bật/tắt engine. Mặc định true. Tắt để tiết kiệm CPU.
 *
 * @returns StockfishEval - kết quả đánh giá mới nhất.
 *
 * @example
 * ```tsx
 * const evaluation = useStockfish(currentFen);
 * // evaluation.score: centipawn (dương = Trắng lợi)
 * // evaluation.mate: số nước chiếu bí (null nếu không có)
 * // evaluation.isCalculating: engine đang tính
 * ```
 */
export function useStockfish(
  fen: string | null | undefined,
  enabled: boolean = true
): StockfishEval {
  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestFenRef = useRef<string | null>(null);
  const [evaluation, setEvaluation] = useState<StockfishEval>(DEFAULT_EVAL);

  // ── Khởi tạo Worker ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let worker: Worker;
    try {
      worker = new Worker(WORKER_PATH);
    } catch (e) {
      console.error("[useStockfish] Không thể tạo Web Worker:", e);
      return;
    }

    workerRef.current = worker;

    // Khởi tạo UCI mode
    worker.postMessage("uci");
    worker.postMessage("isready");

    // Lắng nghe output UCI từ Worker
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      // Worker gửi về { type: "uci", line: "..." }
      const line: string =
        typeof data === "string" ? data : data.line ?? "";

      if (!line) return;

      // Xử lý "readyok" — engine đã sẵn sàng nhận lệnh phân tích
      if (line.trim() === "readyok") {
        // Nếu đã có FEN đang chờ, gửi ngay
        if (latestFenRef.current) {
          sendAnalysis(worker, latestFenRef.current);
        }
        return;
      }

      // Xử lý dòng info score
      if (line.startsWith("info") && line.includes("score")) {
        const turn = latestFenRef.current
          ? getTurnFromFen(latestFenRef.current)
          : "w";
        const parsed = parseInfoLine(line, turn);
        if (parsed && parsed.depth !== undefined) {
          setEvaluation((prev) => ({
            ...prev,
            ...parsed,
            isCalculating: true,
          }));
        }
      }

      // Engine gửi "bestmove" → phân tích hoàn tất
      if (line.startsWith("bestmove")) {
        setEvaluation((prev) => ({ ...prev, isCalculating: false }));
      }
    };

    worker.onerror = (e) => {
      console.error("[useStockfish] Worker error:", e.message || e);
    };

    return () => {
      worker.postMessage("stop");
      worker.postMessage("quit");
      worker.terminate();
      workerRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Gửi FEN mới khi thay đổi ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !fen || !workerRef.current) return;

    latestFenRef.current = fen;

    // Dừng phân tích hiện tại ngay lập tức
    workerRef.current.postMessage("stop");

    // Debounce để tránh gửi liên tục khi FEN thay đổi nhanh
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (workerRef.current && latestFenRef.current) {
        setEvaluation((prev) => ({ ...prev, isCalculating: true, depth: 0 }));
        sendAnalysis(workerRef.current, latestFenRef.current);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fen, enabled]);

  return evaluation;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function sendAnalysis(worker: Worker, fen: string): void {
  // Đặt vị trí và bắt đầu phân tích theo độ sâu
  if (fen === "start" || fen === "startpos") {
    worker.postMessage("position startpos");
  } else {
    worker.postMessage(`position fen ${fen}`);
  }
  worker.postMessage(`go depth ${ANALYSIS_DEPTH}`);
}
