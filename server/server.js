const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const rooms = {};

// Default route for debugging
app.get('/', (req, res) => {
  res.send('Bingo Socket.IO server is running');
});

io.on('connection', (socket) => {
  socket.on('join-room', (roomCode) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        drawnNumbers: [],
      };
    }

    const playerId = `Player ${rooms[roomCode].players.length + 1}`;
    rooms[roomCode].players.push({ id: socket.id, label: playerId, score: 0 });

    socket.join(roomCode);
    socket.emit('player-info', playerId); // Send player label to the client
    console.log(`${playerId} joined room ${roomCode}`);
  });

  socket.on('start-draw', (roomCode) => {
    const nums = Array.from({ length: 100 }, (_, i) => i + 1).sort(() => 0.5 - Math.random());
    let index = 0;

    const interval = setInterval(() => {
      if (index >= nums.length) {
        clearInterval(interval);
        return;
      }
      const next = nums[index++];
      io.to(roomCode).emit('number-drawn', next);
    }, 5000);
  });

  socket.on('score-update', ({ roomCode, score }) => {
    const player = rooms[roomCode]?.players.find(p => p.id === socket.id);
    if (player) {
      player.score = score;
      if (score >= 5) {
        io.to(roomCode).emit('game-won', player.label);
      }
    }
  });
});

server.listen(3001, () => {
  console.log("Server running on port 3001");
});
