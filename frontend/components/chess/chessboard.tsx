"use client"; // Bắt buộc phải có dòng này ở đầu file

import { Chessboard } from "react-chessboard";
import { useState } from "react";
import { Chess, Square } from "chess.js";

export default function ChessBoardV1() {
  // Khởi tạo logic cờ vua bằng chess.js
  const [game, setGame] = useState(new Chess());

  // Hàm xử lý khi người dùng thả quân cờ
  function onDrop(sourceSquare: string, targetSquare: string) {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q", // Mặc định phong Hậu
      });

      if (move === null) return false;

      setGame(new Chess(game.fen())); // Cập nhật lại bàn cờ
      return true;
    } catch (error) {
      return false;
    }
  }

  return (
    <div className="w-[500px] h-[500px] rounded-xl border-[10px] border-purple-900 shadow-2xl shadow-purple-500/40 overflow-hidden">
      <Chessboard

        position={game.fen()}
        onPieceDrop={onDrop}
        // Custom màu sắc theo phong cách Tím - Hồng Chessly
        customDarkSquareStyle={{ backgroundColor: "#7e22ce" }} // Tím đậm
        customLightSquareStyle={{ backgroundColor: "#f3e8ff" }} // Tím cực nhạt (gần như trắng)
        customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 6px rgba(236, 72, 153, 0.75)' }} // Viền Hồng Neon khi thả quân
        animationDuration={300}
      />
    </div>
  );
}