import Phaser from "phaser";
import { io, Socket } from "socket.io-client";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";

interface PlayerData {
  playerId: string;
  position: { x: number; y: number };
  level: number;
  exp: number;
  direction: string;
  action: string;
}

interface EnemyData {
  position: { x: number; y: number };
  health: number;
}

export class MainScene extends Phaser.Scene {
  private socket: Socket;
  private playerId: string;
  private player!: Player;
  private players: { [key: string]: Player } = {};
  private enemies: { [key: string]: Enemy } = {};
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private chatWindow!: HTMLDivElement;
  private chatInput!: HTMLInputElement;
  private currentInputs: { [key: string]: boolean } = {};

  constructor() {
    super({ key: "MainScene" });
    this.playerId = localStorage.getItem("playerId") || this.generateUUID();
    localStorage.setItem("playerId", this.playerId);

    this.socket = io("http://localhost:3000", {
      autoConnect: false,
    });
  }

  preload() {}

  create() {
    this.chatWindow = document.getElementById("chat-window") as HTMLDivElement;
    this.chatInput = document.getElementById("chat-input") as HTMLInputElement;

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
    }

    this.chatInput.addEventListener("keyup", (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        const message = this.chatInput.value;
        if (message.trim() !== "") {
          this.socket.emit("chatMessage", message);
          this.chatInput.value = "";
        }
      }
    });

    this.setupSocketEvents();
    this.socket.connect();
  }

  update(_time: number, _delta: number) {
    if (this.player) {
      let direction = this.player.currentDirection;
      if (this.cursors) {
        this.currentInputs.left = this.cursors.left.isDown;
        this.currentInputs.right = this.cursors.right.isDown;
        this.currentInputs.up = this.cursors.up.isDown;
        this.currentInputs.down = this.cursors.down.isDown;
      }
      const isAttacking = this.input.keyboard?.checkDown(
        this.cursors.space,
        250
      );
      const isWalking = Object.values(this.currentInputs).some(
        (value) => value === true
      );

      if (isAttacking) {
        this.socket.emit("playerInput", {
          ...this.currentInputs,
          direction,
          action: "attack",
        });
      } else if (isWalking) {
        // Determine direction based on input
        if (this.currentInputs.up) {
          direction = "up";
        } else if (this.currentInputs.down) {
          direction = "down";
        } else if (this.currentInputs.left) {
          direction = "left";
        } else if (this.currentInputs.right) {
          direction = "right";
        }

        this.socket.emit("playerInput", {
          ...this.currentInputs,
          direction,
          action: "walk",
        });
      } else {
        this.socket.emit("playerInput", {
          ...this.currentInputs,
          direction,
          action: "idle",
        });
      }
    }

    // Update enemies
    for (const id in this.enemies) {
      this.enemies[id].interpolate();
    }
  }

  private setupSocketEvents() {
    // Attach the connect event listener
    this.socket.on("connect", () => {
      console.log("Connected to server with ID:", this.socket.id);
      this.socket.emit("init", { playerId: this.playerId });
    });

    this.socket.on(
      "init",
      (data: {
        playerData: PlayerData;
        players: { [key: string]: PlayerData };
        enemies: { [key: string]: EnemyData };
      }) => {
        this.updateGameState({ players: data.players, enemies: data.enemies });
      }
    );

    this.socket.on("playerJoined", (playerData: PlayerData) => {
      if (!this.players[playerData.playerId]) {
        this.createOtherPlayer(playerData);
      }
    });

    this.socket.on("playerLeft", (leftPlayerId: string) => {
      if (this.players[leftPlayerId]) {
        this.players[leftPlayerId].destroy();
        delete this.players[leftPlayerId];
      }
    });

    this.socket.on(
      "gameState",
      (state: {
        players: { [key: string]: PlayerData };
        enemies: { [key: string]: EnemyData };
      }) => {
        this.updateGameState(state);
      }
    );

    this.socket.on("levelUp", () => {
      const congratsText = this.add
        .text(400, 300, "Congratulations! Level Up!", {
          fontSize: "32px",
          color: "#fff",
        })
        .setOrigin(0.5);
      this.time.delayedCall(2000, () => {
        congratsText.destroy();
      });
    });

    this.socket.on("chatMessage", (data: { id: string; message: string }) => {
      const messageElement = document.createElement("div");
      messageElement.textContent = `Player ${data.id}: ${data.message}`;
      this.chatWindow.appendChild(messageElement);
      this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    });

    this.socket.on("disconnect", (reason) => {
      console.warn("Disconnected from server:", reason);
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`Attempting to reconnect... (${attemptNumber})`);
    });
  }

  private createPlayer(playerData: PlayerData) {
    this.player = new Player(this, this.socket, playerData);
    this.players[this.playerId] = this.player;
  }

  private createOtherPlayer(playerData: PlayerData) {
    if (this.players[playerData.playerId]) return;
    const otherPlayer = new Player(this, this.socket, playerData);
    this.players[playerData.playerId] = otherPlayer;
  }

  private createEnemy(enemyData: {
    id: string;
    position: { x: number; y: number };
    health: number;
  }) {
    const enemy = new Enemy(this, enemyData);
    this.enemies[enemyData.id] = enemy;
  }

  private updateGameState(state: {
    players: { [key: string]: PlayerData };
    enemies: { [key: string]: EnemyData };
  }) {
    for (const id in state.players) {
      const serverPlayer = state.players[id];
      if (this.players[id]) {
        this.players[id].updatePosition(serverPlayer.position);
        this.players[id].updateDirection(serverPlayer.direction);
        this.players[id].updateAction(serverPlayer.action);
        this.players[id].playAnimation(serverPlayer.action);
        if (id === this.playerId) {
          this.players[id].updateExpBar(serverPlayer.exp, serverPlayer.level);
        }
      } else {
        if (id === this.playerId) {
          this.createPlayer(serverPlayer);
        } else {
          this.createOtherPlayer(serverPlayer);
        }
      }
    }

    for (const id in this.players) {
      if (!state.players[id]) {
        this.players[id].destroy();
        delete this.players[id];
      }
    }

    for (const id in state.enemies) {
      const serverEnemy = state.enemies[id];
      if (this.enemies[id]) {
        this.enemies[id].updatePosition(serverEnemy.position);
        this.enemies[id].updateHealth(serverEnemy.health);
      } else {
        this.createEnemy({ id, ...serverEnemy });
      }
    }

    for (const id in this.enemies) {
      if (!state.enemies[id]) {
        this.enemies[id].destroy();
        delete this.enemies[id];
      }
    }
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}
