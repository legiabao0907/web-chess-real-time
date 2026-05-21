/**
 * stockfish-worker.js
 * 
 * Đây là Web Worker wrapper cho Stockfish engine.
 * File này nằm tại /public/stockfish-worker.js để Next.js phục vụ nó như static asset.
 *
 * Luồng hoạt động:
 *   Main thread --postMessage(cmd)--> Worker --postMessage(line)--> Main thread
 *
 * Cần có stockfish.js (WASM hoặc JS) tại cùng thư mục /public.
 * Tải về từ: https://github.com/nmrugg/stockfish.js/releases
 */

// Tải Stockfish engine vào bộ nhớ Worker
// importScripts chạy đồng bộ trong Web Worker context
importScripts("/stockfish.js");

let engine = null;

// Khởi tạo engine (Stockfish JS export dưới dạng hàm factory hoặc global)
function initEngine() {
  // stockfish.js có thể export theo nhiều cách:
  // - Global function: Stockfish()
  // - self.Stockfish nếu được load qua importScripts
  const factory = self.Stockfish || (typeof Stockfish !== "undefined" ? Stockfish : null);
  if (!factory) {
    self.postMessage({ type: "error", message: "Stockfish not found" });
    return;
  }

  engine = factory();

  // Nhận output từ engine và relay về main thread
  engine.addMessageListener((line) => {
    self.postMessage({ type: "uci", line });
  });

  // Gửi lệnh khởi tạo UCI
  engine.postMessage("uci");
  engine.postMessage("isready");
}

// Xử lý lệnh từ main thread
self.onmessage = (event) => {
  const data = event.data;

  if (!data) return;

  // Lệnh đặc biệt: khởi tạo engine
  if (data === "init" || data.cmd === "init") {
    initEngine();
    return;
  }

  // Forward tất cả lệnh UCI khác thẳng vào engine
  if (engine) {
    const cmd = typeof data === "string" ? data : data.cmd;
    if (cmd) engine.postMessage(cmd);
  }
};

// Tự khởi tạo ngay khi Worker load
initEngine();
