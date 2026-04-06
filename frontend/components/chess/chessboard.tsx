"use client"; // Bắt buộc phải có dòng này ở đầu file

import dynamic from "next/dynamic";
const Chessboard: any = dynamic(() => import("react-chessboard").then((mod: any) => mod.Chessboard), { ssr: false });
import { useState } from "react";
import { Chess, Square } from "chess.js";

export default function ChessBoardV1() {
  // Khởi tạo logic cờ vua bằng chess.js
  const [game, setGame] = useState(new Chess());

  // Hàm xử lý khi người dùng thả quân cờ
  function onDrop(sourceSquare: any, targetSquare: any) {
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
        customDarkSquareStyle={{ backgroundColor: "#7e22ce" }}
        customLightSquareStyle={{ backgroundColor: "#f3e8ff" }}
        customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 6px rgba(236, 72, 153, 0.75)' }}
        animationDuration={300}
      />
    </div>
  );
}