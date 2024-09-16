import Phaser from "phaser";
import { io, Socket } from "socket.io-client";
import { Player } from "../entities/Player";

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

export class MainScene extends Phaser.Scene {
  private socket: Socket;
  private playerId: string;
  private player!: Player;
  private players: { [key: string]: Player } = {};
  private enemies: {
    [key: string]: {
      sprite: Phaser.GameObjects.Triangle;
      healthBar: Phaser.GameObjects.Rectangle;
      maxHealth: number;
      prevPosition: { x: number; y: number };
      targetPosition: { x: number; y: number };
    };
  } = {};
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private chatWindow!: HTMLDivElement;
  private chatInput!: HTMLInputElement;
  private currentInputs: { [key: string]: boolean } = {};

  constructor() {
    super({ key: "MainScene" });
    this.socket = io("http://localhost:3000");
    this.playerId = localStorage.getItem("playerId") || this.generateUUID();
    localStorage.setItem("playerId", this.playerId);
  }

  preload() {
    // Load assets if any
  }

  create() {
    this.chatWindow = document.getElementById("chat-window") as HTMLDivElement;
    this.chatInput = document.getElementById("chat-input") as HTMLInputElement;

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on("keydown-SPACE", () => {
        this.currentInputs.attack = true;
      });
      this.input.keyboard.on("keyup-SPACE", () => {
        this.currentInputs.attack = false;
      });
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
  }

  update(_time: number, _delta: number) {
    if (!this.player) return;

    if (this.cursors) {
      this.currentInputs.left = this.cursors.left.isDown;
      this.currentInputs.right = this.cursors.right.isDown;
      this.currentInputs.up = this.cursors.up.isDown;
      this.currentInputs.down = this.cursors.down.isDown;
    }

    const anyTrue = Object.values(this.currentInputs).some(
      (value) => value === true
    );
    if (anyTrue) {
      this.socket.emit("playerInput", this.currentInputs);
    }

    this.interpolateEnemyPositions();
  }

  private setupSocketEvents() {
    this.socket.on("connect", () => {
      this.socket.emit("init", { playerId: this.playerId });
    });

    this.socket.on(
      "init",
      (data: {
        playerData: PlayerData;
        players: { [key: string]: PlayerData };
        enemies: { [key: string]: EnemyData };
      }) => {
        if (
          data.playerData.playerId &&
          data.playerData.playerId !== this.playerId
        ) {
          this.playerId = data.playerData.playerId;
          localStorage.setItem("playerId", this.playerId);
        }
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

  private createEnemy(id: string, enemyData: EnemyData) {
    const enemy = this.add.triangle(
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
    (enemy as any).enemyId = id;

    const healthBar = this.add.rectangle(
      enemy.x,
      enemy.y - 30,
      40,
      5,
      0x00ff00
    );
    (healthBar as any).maxWidth = 40;

    this.enemies[id] = {
      sprite: enemy,
      healthBar: healthBar,
      maxHealth: enemyData.health,
      prevPosition: { x: enemyData.position.x, y: enemyData.position.y },
      targetPosition: { x: enemyData.position.x, y: enemyData.position.y },
    };
  }

  private updateGameState(state: {
    players: { [key: string]: PlayerData };
    enemies: { [key: string]: EnemyData };
  }) {
    for (const id in state.players) {
      const serverPlayer = state.players[id];
      if (this.players[id]) {
        this.players[id].updatePosition(serverPlayer.position);
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
        const enemyObj = this.enemies[id];
        enemyObj.targetPosition.x = serverEnemy.position.x;
        enemyObj.targetPosition.y = serverEnemy.position.y;

        const healthPercentage = serverEnemy.health / enemyObj.maxHealth;
        enemyObj.healthBar.width =
          healthPercentage * (enemyObj.healthBar as any).maxWidth;

        if (healthPercentage > 0.5) {
          enemyObj.healthBar.fillColor = 0x00ff00;
        } else if (healthPercentage > 0.2) {
          enemyObj.healthBar.fillColor = 0xffff00;
        } else {
          enemyObj.healthBar.fillColor = 0xff0000;
        }
      } else {
        this.createEnemy(id, serverEnemy);
      }
    }

    for (const id in this.enemies) {
      if (!state.enemies[id]) {
        this.enemies[id].sprite.destroy();
        this.enemies[id].healthBar.destroy();
        delete this.enemies[id];
      }
    }
  }

  private interpolateEnemyPositions() {
    for (const id in this.enemies) {
      const enemyObj = this.enemies[id];
      const sprite = enemyObj.sprite;
      const healthBar = enemyObj.healthBar;

      const t = 0.1;
      sprite.x = Phaser.Math.Linear(sprite.x, enemyObj.targetPosition.x, t);
      sprite.y = Phaser.Math.Linear(sprite.y, enemyObj.targetPosition.y, t);

      healthBar.x = sprite.x;
      healthBar.y = sprite.y - 30;
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
