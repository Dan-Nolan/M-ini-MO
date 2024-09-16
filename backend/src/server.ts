import express from "express";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MongoClient, Db, ObjectId, WithId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:5175", // Update with your Vite frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

const mongoUrl = "mongodb://localhost:27017";
let db: Db;

MongoClient.connect(mongoUrl)
  .then((client) => {
    db = client.db("mmorpg");
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error(err));

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// Game constants
const TICK_RATE = 20; // Server updates 20 times per second
const TICK_INTERVAL = 1000 / TICK_RATE;
const MAX_ENEMIES = 5;

// Game state
interface Player {
  playerId: string;
  position: { x: number; y: number };
  level: number;
  exp: number;
  health: number;
  socketId: string;
  direction: string;
  action: string;
}

interface Enemy {
  id: string;
  position: { x: number; y: number };
  health: number;
  alive: boolean;
  velocity: { x: number; y: number };
  changeDirection: () => void;
  move: (deltaTime: number) => void;
}

const players: { [key: string]: Player } = {};
const enemies: { [key: string]: Enemy } = {};

// Mappings between socket IDs and player IDs
const socketIdToPlayerId: { [key: string]: string } = {};
const playerIdToSocketId: { [key: string]: string } = {};

// Enemy class with velocity and direction change
class EnemyImpl implements Enemy {
  id: string;
  position: { x: number; y: number };
  health: number;
  alive: boolean;
  velocity: { x: number; y: number };

  constructor() {
    this.id = uuidv4();
    this.position = { x: Math.random() * 800, y: Math.random() * 600 };
    this.health = 100;
    this.alive = true;
    this.velocity = { x: 0, y: 0 };
    this.changeDirection();
  }

  changeDirection() {
    if (!this.alive) return;

    const speed = 50; // Adjust speed as needed
    const angle = Math.random() * 2 * Math.PI;
    this.velocity.x = Math.cos(angle) * speed;
    this.velocity.y = Math.sin(angle) * speed;

    setTimeout(() => this.changeDirection(), 2000 + Math.random() * 3000); // Change direction every 2-5 seconds
  }

  move(deltaTime: number) {
    if (!this.alive) return;

    const deltaSeconds = deltaTime / 1000;

    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;

    if (this.position.x < 0 || this.position.x > 800) this.velocity.x *= -1;
    if (this.position.y < 0 || this.position.y > 600) this.velocity.y *= -1;

    this.position.x = Math.max(0, Math.min(800, this.position.x));
    this.position.y = Math.max(0, Math.min(600, this.position.y));
  }
}

// Spawn initial enemies
function spawnEnemies() {
  const aliveEnemies = Object.values(enemies).filter((enemy) => enemy.alive);
  const enemiesToSpawn = MAX_ENEMIES - aliveEnemies.length;

  for (let i = 0; i < enemiesToSpawn; i++) {
    const enemy = new EnemyImpl();
    enemies[enemy.id] = enemy;
  }
}
spawnEnemies();

// Socket.io connection
io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);

  // Initialize player
  socket.on("init", async (data: { playerId: string }) => {
    let { playerId } = data;

    socketIdToPlayerId[socket.id] = playerId;
    playerIdToSocketId[playerId] = socket.id;

    let playerData = await db
      .collection<WithId<Player>>("players")
      .findOne({ playerId: playerId });
    if (!playerData) {
      playerData = {
        _id: new ObjectId(),
        playerId: playerId,
        position: { x: 400, y: 300 },
        level: 1,
        exp: 0,
        health: 100,
        socketId: socket.id,
        direction: "right",
        action: "idle",
      };
      await db.collection("players").insertOne(playerData);
    } else {
      playerData.socketId = socket.id;
      await db
        .collection("players")
        .updateOne({ playerId: playerId }, { $set: { socketId: socket.id } });
    }
    players[playerId] = playerData;

    const aliveEnemies: {
      [key: string]: {
        position: { x: number; y: number };
        health: number;
        id: string;
      };
    } = {};
    for (const id in enemies) {
      if (enemies[id].alive) {
        aliveEnemies[id] = {
          position: enemies[id].position,
          health: enemies[id].health,
          id: enemies[id].id,
        };
      }
    }

    socket.emit("init", { playerData, players, enemies: aliveEnemies });
  });

  socket.on("playerInput", (input: any) => {
    const playerId = socketIdToPlayerId[socket.id];
    if (playerId) {
      latestInputs[playerId] = input; // Store the latest input for each player
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const playerId = socketIdToPlayerId[socket.id];
    if (playerId) {
      delete players[playerId];
      delete socketIdToPlayerId[socket.id];
      delete playerIdToSocketId[playerId];
      delete latestInputs[playerId]; // Remove the player's input on disconnect
      socket.broadcast.emit("playerLeft", playerId);
    }
  });

  socket.on("chatMessage", (msg: string) => {
    const playerId = socketIdToPlayerId[socket.id];
    io.emit("chatMessage", { id: playerId, message: msg });
  });
});

let lastUpdateTime = Date.now();

const latestInputs: { [key: string]: any } = {};

function gameLoop() {
  const now = Date.now();
  const deltaTime = now - lastUpdateTime;
  lastUpdateTime = now;

  processInputs();
  updateGameState(deltaTime);

  const state = getGameState();
  io.emit("gameState", state);

  spawnEnemies();
}

setInterval(gameLoop, TICK_INTERVAL);

function processInputs() {
  for (const playerId in latestInputs) {
    const input = latestInputs[playerId];
    const player = players[playerId];
    if (!player) continue;

    const speed = 200 / TICK_RATE;
    if (input.left) player.position.x -= speed;
    if (input.right) player.position.x += speed;
    if (input.up) player.position.y -= speed;
    if (input.down) player.position.y += speed;

    player.position.x = Math.max(0, Math.min(800, player.position.x));
    player.position.y = Math.max(0, Math.min(600, player.position.y));
    player.direction = input.direction;
    player.action = input.action;

    if (input.attack) {
      handleAttack(playerId);
    }
  }
  // Clear the latest inputs after processing
  for (const playerId in latestInputs) {
    delete latestInputs[playerId];
  }
}

function updateGameState(deltaTime: number) {
  for (const id in enemies) {
    const enemy = enemies[id];
    if (enemy.alive) {
      enemy.move(deltaTime);
    } else {
      delete enemies[id];
    }
  }
}

function handleAttack(playerId: string) {
  const player = players[playerId];
  if (!player) return;

  let closestEnemy: Enemy | null = null;
  let minDistance = Infinity;
  for (const id in enemies) {
    const enemy = enemies[id];
    if (!enemy.alive) continue;
    const distance = getDistance(player.position, enemy.position);
    if (distance < minDistance && distance < 50) {
      minDistance = distance;
      closestEnemy = enemy;
    }
  }

  if (closestEnemy) {
    closestEnemy.health -= 10;
    if (closestEnemy.health <= 0) {
      closestEnemy.alive = false;
      player.exp += 50;
      if (player.exp >= player.level * 100) {
        player.exp = 0;
        player.level += 1;
        const socketId = playerIdToSocketId[playerId];
        if (socketId) {
          io.to(socketId).emit("levelUp", player.level);
        }
      }
      db.collection("players").updateOne(
        { playerId: playerId },
        { $set: { exp: player.exp, level: player.level } }
      );
    }
  }
}

function getGameState() {
  const simplifiedPlayers: {
    [key: string]: {
      playerId: string;
      position: { x: number; y: number };
      level: number;
      exp: number;
      direction: string;
      action: string;
    };
  } = {};
  for (const playerId in players) {
    const player = players[playerId];
    simplifiedPlayers[playerId] = {
      playerId: playerId,
      position: player.position,
      level: player.level,
      exp: player.exp,
      direction: player.direction,
      action: player.action,
    };
  }

  const simplifiedEnemies: {
    [key: string]: {
      position: { x: number; y: number };
      health: number;
      id: string;
    };
  } = {};
  for (const id in enemies) {
    const enemy = enemies[id];
    if (enemy.alive) {
      simplifiedEnemies[id] = {
        position: enemy.position,
        health: enemy.health,
        id: enemy.id,
      };
    }
  }

  return { players: simplifiedPlayers, enemies: simplifiedEnemies };
}

function getDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
