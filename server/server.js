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

app.get('/', (req, res) => {
  res.send('Bingo Socket.IO server is running');
});

io.on('connection', (socket) => {
  socket.on('join-room', (roomCode) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        drawnNumbers: [],
        currentTurn: null,
      };
    }

    const room = rooms[roomCode];
    const playerId = `Player ${room.players.length + 1}`;
    room.players.push({ id: socket.id, label: playerId, score: 0 });

    socket.join(roomCode);
    socket.emit('player-info', playerId);

    if (room.players.length === 2 && !room.currentTurn) {
      room.currentTurn = room.players[0].id;
      io.to(roomCode).emit('turn', room.players[0].label);
    }

    console.log(`${playerId} joined room ${roomCode}`);
  });

  socket.on('number-selected', ({ roomCode, number, player }) => {
    const room = rooms[roomCode];
    if (!room) return;

    // Validate it's the correct player's turn
    if (socket.id !== room.currentTurn) return;

    if (!room.drawnNumbers.includes(number)) {
      room.drawnNumbers.push(number);

      io.to(roomCode).emit('number-selected', {
        number,
        player,
      });

      // Switch turn
      const nextPlayer = room.players.find(p => p.id !== socket.id);
      if (nextPlayer) {
        room.currentTurn = nextPlayer.id;
        io.to(roomCode).emit('turn', nextPlayer.label);
      }
    }
  });

  socket.on('score-update', ({ roomCode, score }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.score = score;
      if (score >= 5) {
        io.to(roomCode).emit('game-won', player.label);
      }
    }
  });

  socket.on('reset-game', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.drawnNumbers = [];

    // Reset all players' scores
    room.players.forEach(p => {
      p.score = 0;
    });

    // Reset turn to Player 1 if present
    if (room.players.length > 0) {
      room.currentTurn = room.players[0].id;
      io.to(roomCode).emit('turn', room.players[0].label);
    }

    io.to(roomCode).emit('reset-client');
  });

  socket.on('disconnect', () => {
    for (const [roomCode, room] of Object.entries(rooms)) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players.splice(playerIndex, 1)[0];
        console.log(`${player.label} left room ${roomCode}`);

        // If room is empty, delete it
        if (room.players.length === 0) {
          delete rooms[roomCode];
        } else {
          // Reset game state if a player disconnects
          room.drawnNumbers = [];
          room.currentTurn = room.players[0].id;
          io.to(roomCode).emit('reset-client');
          io.to(roomCode).emit('turn', room.players[0].label);
        }
        break;
      }
    }
  });
});

server.listen(3002, () => {
  console.log("Server running on port 3002");
});
