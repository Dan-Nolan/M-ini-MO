import Phaser from "phaser";
import { Socket } from "socket.io-client";

interface PlayerData {
  playerId: string;
  position: { x: number; y: number };
  level: number;
  exp: number;
}

export class Player {
  private scene: Phaser.Scene;
  private socket: Socket;
  private playerId: string;
  private sprite: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private expBar: Phaser.GameObjects.Rectangle;
  private levelText: Phaser.GameObjects.Text;
  private exp: number;
  private level: number;

  constructor(scene: Phaser.Scene, socket: Socket, playerData: PlayerData) {
    this.scene = scene;
    this.socket = socket;
    this.playerId = playerData.playerId;
    this.exp = playerData.exp;
    this.level = playerData.level;

    this.sprite = this.scene.add.circle(
      playerData.position.x,
      playerData.position.y,
      20,
      0xff0000
    );
    (this.sprite as any).playerId = this.playerId; // TypeScript workaround for custom properties

    this.label = this.scene.add
      .text(this.sprite.x, this.sprite.y - 30, `Player ${this.playerId}`, {
        fontSize: "12px",
        color: "#fff",
      })
      .setOrigin(0.5);

    this.levelText = this.scene.add.text(10, 10, `Level: ${this.level}`, {
      fontSize: "16px",
      color: "#fff",
    });

    this.expBar = this.scene.add.rectangle(400, 580, 200, 20, 0x00ff00);
    this.updateExpBar(this.exp, this.level);
  }

  getExp() {
    return this.exp;
  }

  updatePosition(position: { x: number; y: number }) {
    this.sprite.x = position.x;
    this.sprite.y = position.y;
    this.label.x = position.x;
    this.label.y = position.y - 30;
  }

  updateExpBar(exp: number, level: number) {
    this.exp = exp;
    this.level = level;
    const expPercentage = (exp / (level * 100)) * 200; // Bar width scales with EXP
    this.expBar.width = expPercentage;
    this.expBar.x = 400 - (200 - this.expBar.width) / 2; // Adjust position
    this.levelText.setText(`Level: ${level}`);
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
    this.expBar.destroy();
    this.levelText.destroy();
  }
}
