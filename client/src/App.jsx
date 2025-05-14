import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3002");

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export default function BingoGrid() {
  const [joined, setJoined] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [inputRoomCode, setInputRoomCode] = useState("");
  const [numbers, setNumbers] = useState([]);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [winningLines, setWinningLines] = useState([]);
  const [bingoMessage, setBingoMessage] = useState(false);
  const [score, setScore] = useState(0);
  const [playerLabel, setPlayerLabel] = useState("");
  const [winner, setWinner] = useState("");
  const timeoutRef = useRef(null);

  const generateNewGame = () => {
    const nums = shuffleArray(Array.from({ length: 100 }, (_, i) => i + 1)).slice(0, 25);
    setNumbers(nums);
    setSelectedNumbers([]);
    setWinningLines([]);
    setBingoMessage(false);
    setScore(0);
    setCurrentNumber(null);
    clearTimeout(timeoutRef.current);
  };

  const startNumberRotation = () => {
    if (roomCode) {
      socket.emit("start-draw", roomCode);
    }
  };

  const handleCellClick = (num) => {
    if (num === currentNumber && !selectedNumbers.includes(num)) {
      const updatedSelection = [...selectedNumbers, num];
      setSelectedNumbers(updatedSelection);
      checkWinningLines(updatedSelection);
    }
  };

  const checkWinningLines = (selected) => {
    const lines = [];
    const grid = Array(5).fill(null).map(() => Array(5).fill(false));
    numbers.forEach((num, idx) => {
      const row = Math.floor(idx / 5);
      const col = idx % 5;
      if (selected.includes(num)) grid[row][col] = true;
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
    const base =
      "w-16 h-16 flex items-center justify-center text-lg font-semibold rounded-xl shadow-sm transition-all duration-200 cursor-pointer ";
    const selected = selectedNumbers.includes(num)
      ? "bg-green-400 text-white"
      : "bg-purple-100 text-purple-800 hover:bg-purple-200";
    return base + selected;
  };

  useEffect(() => {
    if (joined) generateNewGame();
    return () => clearTimeout(timeoutRef.current);
  }, [joined]);

  useEffect(() => {
    socket.on("number-drawn", (num) => setCurrentNumber(num));
    socket.on("player-info", (label) => setPlayerLabel(label));
    socket.on("game-won", (winnerLabel) => setWinner(winnerLabel));

    return () => {
      socket.off("number-drawn");
      socket.off("player-info");
      socket.off("game-won");
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
            if (inputRoomCode.trim() !== "") {
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
      {playerLabel && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-xl shadow text-purple-700 font-semibold text-xl">
          {playerLabel}
        </div>
      )}
      {winner && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-3xl font-bold px-6 py-3 rounded-xl shadow-lg animate-pulse">
          🎉 {winner} wins!
        </div>
      )}
      <div className="absolute top-4 left-4 w-20 h-20 bg-white text-purple-700 rounded-xl shadow-xl flex items-center justify-center text-3xl font-bold">
        {currentNumber !== null ? currentNumber : "--"}
      </div>
      <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-xl shadow text-purple-700 font-semibold text-xl">
        Score: {score}
      </div>
      <h1 className="text-5xl font-bold text-purple-700 mb-8 drop-shadow-md">BINGO!</h1>

      {bingoMessage && (
        <div className="mb-4 text-4xl font-bold text-green-600 animate-bounce">BINGO!</div>
      )}

      <div className="relative">
        <div className="grid grid-cols-5 gap-4 bg-white p-4 rounded-2xl shadow-xl relative">
          {numbers.map((num, index) => (
            <div key={index} onClick={() => handleCellClick(num)} className={getCellClasses(num)}>
              {num}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <button
          onClick={startNumberRotation}
          className="px-6 py-2 bg-purple-600 text-white rounded-xl shadow hover:bg-purple-700 transition"
        >
          Start
        </button>
        <button
          onClick={generateNewGame}
          className="px-6 py-2 bg-pink-500 text-white rounded-xl shadow hover:bg-pink-600 transition"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
