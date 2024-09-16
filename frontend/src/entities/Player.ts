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
  private sprite: Phaser.GameObjects.Sprite;
  private label: Phaser.GameObjects.Text;
  private expBar: Phaser.GameObjects.Rectangle;
  private levelText: Phaser.GameObjects.Text;
  private exp: number;
  private level: number;
  private isMoving: boolean = false;
  private isAttacking: boolean = false;
  public currentDirection: string = "right";

  constructor(scene: Phaser.Scene, socket: Socket, playerData: PlayerData) {
    this.scene = scene;
    this.socket = socket;
    this.playerId = playerData.playerId;
    this.exp = playerData.exp;
    this.level = playerData.level;

    this.sprite = this.scene.add.sprite(
      playerData.position.x,
      playerData.position.y,
      "warrior"
    );
    this.sprite.setScale(0.2); // Adjust scale as needed
    this.sprite.play(`idle_right`);

    this.label = this.scene.add
      .text(this.sprite.x, this.sprite.y - 50, `Player ${this.playerId}`, {
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

  public static createAnimations(scene: Phaser.Scene) {
    const directions = ["right", "left", "up", "down"];

    directions.forEach((direction) => {
      // Idle Animation
      scene.anims.create({
        key: `idle_${direction}`,
        frames: scene.anims.generateFrameNumbers("warrior", {
          start: Player.getFrameStart(direction, "idle"),
          end: Player.getFrameEnd(direction, "idle"),
        }),
        frameRate: 6,
        repeat: -1,
      });

      // Walk Animation
      scene.anims.create({
        key: `walk_${direction}`,
        frames: scene.anims.generateFrameNumbers("warrior", {
          start: Player.getFrameStart(direction, "walk"),
          end: Player.getFrameEnd(direction, "walk"),
        }),
        frameRate: 6,
        repeat: -1,
      });

      // Attack Animation
      scene.anims.create({
        key: `attack_${direction}`,
        frames: scene.anims.generateFrameNumbers("warrior", {
          start: Player.getFrameStart(direction, "attack1"),
          end: Player.getFrameEnd(direction, "attack2"),
        }),
        frameRate: 12,
        repeat: 0,
        yoyo: false,
      });
    });
  }

  private static getFrameStart(direction: string, action: string): number {
    const rowMap: { [key: string]: number } = {
      idle: 0,
      walk: 1,
      attack1_right: 2,
      attack2_right: 3,
      attack1_down: 4,
      attack2_down: 5,
      attack1_up: 6,
      attack2_up: 7,
    };
    if (action.startsWith("attack")) {
      return rowMap[`${action}_${direction}`] * 6;
    }
    return rowMap[action] * 6;
  }

  private static getFrameEnd(direction: string, action: string): number {
    return Player.getFrameStart(direction, action) + 5;
  }

  getExp() {
    return this.exp;
  }

  updatePosition(position: { x: number; y: number }) {
    this.sprite.x = position.x;
    this.sprite.y = position.y;
    this.label.x = position.x;
    this.label.y = position.y - 50;
  }

  updateExpBar(exp: number, level: number) {
    this.exp = exp;
    this.level = level;
    const expPercentage = (exp / (level * 100)) * 200; // Bar width scales with EXP
    this.expBar.width = expPercentage;
    this.expBar.x = 400 - (200 - this.expBar.width) / 2; // Adjust position
    this.levelText.setText(`Level: ${level}`);
  }

  playAnimation(action: string, direction: string) {
    if (this.isAttacking) return; // Prevent interruptions during attack

    if (this.currentDirection !== direction) {
      this.currentDirection = direction;
      this.sprite.setFlipX(direction === "left");
    }

    if (action === "idle") {
      this.sprite.play(`idle_${direction}`, true);
      this.isMoving = false;
    } else if (action === "walk") {
      this.sprite.play(`walk_${direction}`, true);
      this.isMoving = true;
    } else if (action === "attack") {
      this.isAttacking = true;
      this.sprite.play(`attack_${direction}`, true);
      this.sprite.on(
        "animationcomplete",
        () => {
          this.isAttacking = false;
          this.playAnimation(
            this.isMoving ? "walk" : "idle",
            this.currentDirection
          );
        },
        this
      );
    }
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
    this.expBar.destroy();
    this.levelText.destroy();
  }
}
