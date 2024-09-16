import Phaser from "phaser";
import { io, Socket } from "socket.io-client";

interface PlayerData {
  playerId: string;
  position: { x: number; y: number };
  level: number;
  exp: number;
}

interface EnemyData {
  position: { x: number; y: number };
  health: number;
}

const socket: Socket = io("http://localhost:3000");

// Generate or retrieve player ID
let playerId: string = localStorage.getItem("playerId") || generateUUID();
localStorage.setItem("playerId", playerId);

function generateUUID(): string {
  // Simple UUID generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Phaser game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: "game-container",
  physics: {
    default: "arcade",
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

new Phaser.Game(config);

let self: Phaser.Scene;
let player: Phaser.GameObjects.Arc;
let players: {
  [key: string]: {
    sprite: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
  };
} = {};
let enemies: {
  [key: string]: {
    sprite: Phaser.GameObjects.Triangle;
    healthBar: Phaser.GameObjects.Rectangle;
    maxHealth: number;
    prevPosition: { x: number; y: number };
    targetPosition: { x: number; y: number };
  };
} = {};
let cursors: Phaser.Types.Input.Keyboard.CursorKeys;
let expBar: Phaser.GameObjects.Rectangle;
let levelText: Phaser.GameObjects.Text;
let chatWindow = document.getElementById("chat-window") as HTMLDivElement;
let chatInput = document.getElementById("chat-input") as HTMLInputElement;
let currentInputs: { [key: string]: boolean } = {};

// Preload assets
function preload(this: Phaser.Scene) {
  // Load assets if any
}

// Create game objects
function create(this: Phaser.Scene) {
  self = this;

  // Initialize input
  if (this.input.keyboard) {
    cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on("keydown-SPACE", () => {
      currentInputs.attack = true;
    });
    this.input.keyboard.on("keyup-SPACE", () => {
      currentInputs.attack = false;
    });
  }

  // Handle chat input
  chatInput.addEventListener("keyup", (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      const message = chatInput.value;
      if (message.trim() !== "") {
        socket.emit("chatMessage", message);
        chatInput.value = "";
      }
    }
  });

  // Socket events
  socket.on("connect", () => {
    socket.emit("init", { playerId: playerId }); // Include playerId here
  });

  socket.on(
    "init",
    (data: {
      playerData: PlayerData;
      players: { [key: string]: PlayerData };
      enemies: { [key: string]: EnemyData };
    }) => {
      // Update playerId in case it's different
      if (data.playerData.playerId && data.playerData.playerId !== playerId) {
        playerId = data.playerData.playerId;
        localStorage.setItem("playerId", playerId);
      }

      // Process initial game state
      updateGameState({ players: data.players, enemies: data.enemies });
    }
  );

  socket.on("playerJoined", (playerData: PlayerData) => {
    if (!players[playerData.playerId]) {
      createOtherPlayer(playerData);
    }
  });

  socket.on("playerLeft", (leftPlayerId: string) => {
    if (players[leftPlayerId]) {
      players[leftPlayerId].sprite.destroy();
      players[leftPlayerId].label.destroy();
      delete players[leftPlayerId];
    }
  });

  socket.on(
    "gameState",
    (state: {
      players: { [key: string]: PlayerData };
      enemies: { [key: string]: EnemyData };
    }) => {
      updateGameState(state);
    }
  );

  socket.on("levelUp", (newLevel: number) => {
    levelText.setText(`Level: ${newLevel}`);
    const congratsText = self.add
      .text(400, 300, "Congratulations! Level Up!", {
        fontSize: "32px",
        color: "#fff",
      })
      .setOrigin(0.5);
    self.time.delayedCall(2000, () => {
      congratsText.destroy();
    });
  });

  socket.on("chatMessage", (data: { id: string; message: string }) => {
    const messageElement = document.createElement("div");
    messageElement.textContent = `Player ${data.id}: ${data.message}`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}

// Update game loop
function update(this: Phaser.Scene, _time: number, _delta: number) {
  if (!player) return;

  // Capture inputs
  if (cursors) {
    currentInputs.left = cursors.left.isDown;
    currentInputs.right = cursors.right.isDown;
    currentInputs.up = cursors.up.isDown;
    currentInputs.down = cursors.down.isDown;
  }

  const anyTrue = Object.values(currentInputs).some((value) => value === true);
  if (anyTrue) {
    console.log(anyTrue);
    socket.emit("playerInput", currentInputs);
  }

  // Interpolate enemy positions
  for (const id in enemies) {
    const enemyObj = enemies[id];
    const sprite = enemyObj.sprite;
    const healthBar = enemyObj.healthBar;

    // Calculate interpolation factor
    const t = 0.1; // Adjust for smoother movement
    sprite.x = Phaser.Math.Linear(sprite.x, enemyObj.targetPosition.x, t);
    sprite.y = Phaser.Math.Linear(sprite.y, enemyObj.targetPosition.y, t);

    // Update health bar position
    healthBar.x = sprite.x;
    healthBar.y = sprite.y - 30;
  }
}

// Create player
function createPlayer(playerData: PlayerData) {
  player = self.add.circle(
    playerData.position.x,
    playerData.position.y,
    20,
    0xff0000
  );
  (player as any).playerId = playerId; // TypeScript workaround for custom properties
  const playerLabel = self.add
    .text(player.x, player.y - 30, `Player ${playerId}`, {
      fontSize: "12px",
      color: "#fff",
    })
    .setOrigin(0.5);
  players[playerId] = { sprite: player, label: playerLabel };

  // Initialize EXP bar and level text
  expBar = self.add.rectangle(400, 580, 200, 20, 0x00ff00);
  updateExpBar(playerData.exp, playerData.level);
  levelText = self.add.text(10, 10, `Level: ${playerData.level}`, {
    fontSize: "16px",
    color: "#fff",
  });
}

// Create other players
function createOtherPlayer(playerData: PlayerData) {
  if (players[playerData.playerId]) return;

  const otherPlayer = self.add.circle(
    playerData.position.x,
    playerData.position.y,
    20,
    0x0000ff
  );
  (otherPlayer as any).playerId = playerData.playerId; // TypeScript workaround for custom properties
  const playerLabel = self.add
    .text(otherPlayer.x, otherPlayer.y - 30, `Player ${playerData.playerId}`, {
      fontSize: "12px",
      color: "#fff",
    })
    .setOrigin(0.5);
  players[playerData.playerId] = { sprite: otherPlayer, label: playerLabel };
}

// Create enemy
function createEnemy(id: string, enemyData: EnemyData) {
  const enemy = self.add.triangle(
    enemyData.position.x,
    enemyData.position.y,
    0,
    0,
    20,
    40,
    40,
    0,
    0xff00ff
  );
  (enemy as any).enemyId = id; // TypeScript workaround for custom properties

  // Add health bar
  const healthBar = self.add.rectangle(enemy.x, enemy.y - 30, 40, 5, 0x00ff00);
  (healthBar as any).maxWidth = 40; // TypeScript workaround for custom properties

  enemies[id] = {
    sprite: enemy,
    healthBar: healthBar,
    maxHealth: enemyData.health,
    prevPosition: { x: enemyData.position.x, y: enemyData.position.y },
    targetPosition: { x: enemyData.position.x, y: enemyData.position.y },
  };
}

function updateGameState(state: {
  players: { [key: string]: PlayerData };
  enemies: { [key: string]: EnemyData };
}) {
  // Update players
  for (const id in state.players) {
    const serverPlayer = state.players[id];
    if (players[id]) {
      // Update existing player sprite position
      players[id].sprite.x = serverPlayer.position.x;
      players[id].sprite.y = serverPlayer.position.y;

      // Update label position
      players[id].label.x = serverPlayer.position.x;
      players[id].label.y = serverPlayer.position.y - 30;

      if (id === playerId) {
        // Update local player's EXP bar and level text
        updateExpBar(serverPlayer.exp, serverPlayer.level);
        levelText.setText(`Level: ${serverPlayer.level}`);
      }
    } else {
      if (id === playerId) {
        // Local player sprite doesn't exist, create it
        createPlayer(serverPlayer);
      } else {
        // Create other player sprite
        createOtherPlayer(serverPlayer);
      }
    }
  }

  // Remove players not in server state
  for (const id in players) {
    if (!state.players[id]) {
      players[id].sprite.destroy();
      players[id].label.destroy();
      delete players[id];
    }
  }

  // Update enemies
  for (const id in state.enemies) {
    const serverEnemy = state.enemies[id];
    if (enemies[id]) {
      const enemyObj = enemies[id];
      // Update target position for interpolation
      enemyObj.targetPosition.x = serverEnemy.position.x;
      enemyObj.targetPosition.y = serverEnemy.position.y;

      // Update health bar width
      const healthPercentage = serverEnemy.health / enemyObj.maxHealth;
      enemyObj.healthBar.width =
        healthPercentage * (enemyObj.healthBar as any).maxWidth; // TypeScript workaround for custom properties

      // Optionally, change color based on health
      if (healthPercentage > 0.5) {
        enemyObj.healthBar.fillColor = 0x00ff00; // Green
      } else if (healthPercentage > 0.2) {
        enemyObj.healthBar.fillColor = 0xffff00; // Yellow
      } else {
        enemyObj.healthBar.fillColor = 0xff0000; // Red
      }
    } else {
      // New enemy spawned
      createEnemy(id, serverEnemy); // Pass the enemy ID
    }
  }

  // Remove enemies not in server state
  for (const id in enemies) {
    if (!state.enemies[id]) {
      // Enemy no longer exists, remove it
      enemies[id].sprite.destroy();
      enemies[id].healthBar.destroy();
      delete enemies[id];
    }
  }
}

// Update EXP bar
function updateExpBar(exp: number, level: number) {
  const expPercentage = (exp / (level * 100)) * 200; // Bar width scales with EXP
  expBar.width = expPercentage;
  expBar.x = 400 - (200 - expBar.width) / 2; // Adjust position
}
