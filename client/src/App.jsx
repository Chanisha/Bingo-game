import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3002");

export default function BingoGrid() {
  const [joined, setJoined] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [inputRoomCode, setInputRoomCode] = useState("");
  const [numbers, setNumbers] = useState(Array(25).fill(""));
  const [isBoardFinalized, setIsBoardFinalized] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [winningLines, setWinningLines] = useState([]);
  const [bingoMessage, setBingoMessage] = useState(false);
  const [score, setScore] = useState(0);
  const [playerLabel, setPlayerLabel] = useState("");
  const [winner, setWinner] = useState("");
  const [currentNumber, setCurrentNumber] = useState(null);
  const [currentTurn, setCurrentTurn] = useState("");
  const timeoutRef = useRef(null);

  const handleInputChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newNumbers = [...numbers];
    newNumbers[index] = value === "" ? "" : Math.max(1, Math.min(25, +value));
    setNumbers(newNumbers);
  };

  const finalizeBoard = () => {
    const nums = numbers.map(Number);
    const unique = new Set(nums);
    if (unique.size !== 25 || nums.some(n => isNaN(n) || n < 1 || n > 25)) {
      alert("Fill all 25 cells uniquely with numbers from 1 to 25.");
      return;
    }
    setIsBoardFinalized(true);
    socket.emit("board-finalized", { roomCode, player: playerLabel });
  };

  const handleCellClick = (num) => {
    if (!isBoardFinalized || winner || selectedNumbers.includes(num)) return;
    if (playerLabel !== currentTurn) return;

    setSelectedNumbers([...selectedNumbers, num]);
    checkWinningLines([...selectedNumbers, num]);
    socket.emit("number-selected", { roomCode, number: num, player: playerLabel });
  };

  const checkWinningLines = (selected) => {
    const lines = [];
    const grid = Array(5).fill(null).map(() => Array(5).fill(false));
    numbers.forEach((num, idx) => {
      const row = Math.floor(idx / 5);
      const col = idx % 5;
      if (selected.includes(Number(num))) grid[row][col] = true;
    });

    for (let i = 0; i < 5; i++) {
      if (grid[i].every(cell => cell)) lines.push(`row-${i}`);
      if (grid.every(row => row[i])) lines.push(`col-${i}`);
    }
    if (grid.every((row, i) => row[i])) lines.push("diag-main");
    if (grid.every((row, i) => row[4 - i])) lines.push("diag-anti");

    const newLines = lines.filter(line => !winningLines.includes(line));
    if (newLines.length > 0) {
      setBingoMessage(true);
      const updatedScore = score + newLines.length;
      setScore(updatedScore);
      socket.emit("score-update", { roomCode, score: updatedScore });

      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setBingoMessage(false), 3000);
    }

    setWinningLines([...winningLines, ...newLines]);
  };

  const getCellClasses = (num) => {
    const base = "w-16 h-16 flex items-center justify-center text-lg font-semibold rounded-xl shadow-sm transition-all duration-200 cursor-pointer ";
    const selected = selectedNumbers.includes(Number(num))
      ? "bg-green-400 text-white"
      : isBoardFinalized
        ? (playerLabel === currentTurn ? "bg-purple-100 text-purple-800 hover:bg-purple-200" : "bg-gray-200 text-gray-500 cursor-not-allowed")
        : "bg-gray-100 text-gray-500 cursor-not-allowed";
    return base + selected;
  };

  const resetGame = () => {
    setNumbers(Array(25).fill(""));
    setSelectedNumbers([]);
    setWinningLines([]);
    setBingoMessage(false);
    setScore(0);
    setWinner("");
    setCurrentNumber(null);
    setIsBoardFinalized(false);
    clearTimeout(timeoutRef.current);
    socket.emit("reset-game", roomCode);
  };

  useEffect(() => {
    if (joined) resetGame();
    return () => clearTimeout(timeoutRef.current);
  }, [joined]);

  useEffect(() => {
    socket.on("player-info", (label) => setPlayerLabel(label));
    socket.on("number-selected", ({ number }) => {
      setCurrentNumber(number);
      setSelectedNumbers(prev => prev.includes(number) ? prev : [...prev, number]);
    });
    socket.on("turn", (turnPlayer) => setCurrentTurn(turnPlayer));
    socket.on("game-won", (winnerLabel) => setWinner(winnerLabel));
    socket.on("reset-client", () => resetGame());

    return () => {
      socket.off("player-info");
      socket.off("number-selected");
      socket.off("turn");
      socket.off("game-won");
      socket.off("reset-client");
    };
  }, []);

  if (!joined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 p-4">
        <h1 className="text-4xl font-bold text-purple-700 mb-4">Join Bingo Room</h1>
        <input
          type="text"
          placeholder="Enter Room Code"
          value={inputRoomCode}
          onChange={(e) => setInputRoomCode(e.target.value)}
          className="px-4 py-2 rounded-xl border border-purple-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
        />
        <button
          onClick={() => {
            if (inputRoomCode.trim()) {
              socket.emit("join-room", inputRoomCode);
              setRoomCode(inputRoomCode);
              setJoined(true);
            }
          }}
          className="px-6 py-2 bg-purple-600 text-white rounded-xl shadow hover:bg-purple-700 transition"
        >
          Join Room
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 p-4 relative">
      <div className="absolute top-4 left-4 w-24 h-20 bg-white text-purple-700 rounded-xl shadow-xl flex flex-col items-center justify-center text-sm font-bold p-2">
        <div className="text-xs">Last Selected</div>
        <div className="text-2xl">{currentNumber !== null ? currentNumber : "--"}</div>
      </div>
      <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-xl shadow text-purple-700 font-semibold text-xl flex flex-col items-center">
        <div>Score: {score}</div>
        <div className="text-sm text-gray-500">{playerLabel}</div>
        {isBoardFinalized && <div className="text-xs mt-1">{currentTurn === playerLabel ? "Your Turn" : "Waiting..."}</div>}
      </div>
      <h1 className="text-5xl font-bold text-purple-700 mb-6 drop-shadow-md">BINGO!</h1>

      {bingoMessage && (
        <div className="mb-4 text-4xl font-bold text-green-600 animate-bounce">BINGO!</div>
      )}

      <div className="relative">
        <div className="grid grid-cols-5 gap-4 bg-white p-4 rounded-2xl shadow-xl relative">
          {numbers.map((num, index) => (
            <div key={index}>
              {isBoardFinalized ? (
                <div onClick={() => handleCellClick(Number(num))} className={getCellClasses(num)}>
                  {num}
                </div>
              ) : (
                <input
                  type="number"
                  value={num}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  className="w-16 h-16 text-center text-lg font-semibold rounded-xl border border-purple-300 shadow focus:outline-none"
                />
              )}
            </div>
          ))}
          {winner && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-white px-6 py-4 rounded-2xl shadow-xl border border-green-300 text-center text-green-700 font-bold text-2xl animate-bounce">
              🎉 {winner} Wins!
              <div className="mt-4">
                <button
                  onClick={resetGame}
                  className="px-4 py-2 bg-pink-500 text-white rounded-xl shadow hover:bg-pink-600 transition"
                >
                  Reset Game
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isBoardFinalized && (
        <button
          onClick={finalizeBoard}
          className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-xl shadow hover:bg-purple-700 transition"
        >
          Finalize Board
        </button>
      )}
    </div>
  );
}
