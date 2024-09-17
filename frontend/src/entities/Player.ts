import Phaser from "phaser";
import { Socket } from "socket.io-client";

interface PlayerData {
  playerId: string;
  position: { x: number; y: number };
  level: number;
  exp: number;
  direction: string;
  action: string;
}

export class Player {
  protected scene: Phaser.Scene;
  protected socket: Socket;
  protected playerId: string;
  protected sprite: Phaser.GameObjects.Sprite;
  protected label: Phaser.GameObjects.Text;
  protected exp: number;
  protected level: number;
  protected isMoving: boolean = false;
  protected isAttacking: boolean = false;
  public currentDirection: string = "right";
  public currentAction: string = "idle";
  public isLocal: boolean;

  constructor(
    scene: Phaser.Scene,
    socket: Socket,
    playerData: PlayerData,
    isLocal: boolean = false
  ) {
    this.scene = scene;
    this.socket = socket;
    this.playerId = playerData.playerId;
    this.exp = playerData.exp;
    this.level = playerData.level;
    this.isLocal = isLocal;

    this.sprite = this.scene.add.sprite(
      playerData.position.x,
      playerData.position.y,
      "player"
    );
    this.sprite.setScale(1); // Adjust scale as needed
    this.sprite.play(`idle_right`);

    this.label = this.scene.add
      .text(
        this.sprite.x,
        this.sprite.y - 15,
        `${this.playerId.slice(0, 6)}` + (isLocal ? " (you)" : ""),
        {
          fontSize: "12px",
          color: "#fff",
        }
      )
      .setOrigin(0.5);
  }

  public static createAnimations(scene: Phaser.Scene) {
    // Define animation configurations based on the new spritesheet
    // Each row has 6 frames except for attack and dying animations

    // Idle Animations
    scene.anims.create({
      key: "idle",
      frames: scene.anims.generateFrameNumbers("player", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: "idle_down",
      frames: scene.anims.generateFrameNumbers("player", { start: 0, end: 5 }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: "idle_right",
      frames: scene.anims.generateFrameNumbers("player", { start: 6, end: 11 }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: "idle_left",
      frames: scene.anims.generateFrameNumbers("player", { start: 6, end: 11 }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: "idle_up",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 12,
        end: 17,
      }),
      frameRate: 6,
      repeat: -1,
    });

    // Walking Animations
    scene.anims.create({
      key: "walk_down",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 18,
        end: 23,
      }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: "walk_right",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 24,
        end: 29,
      }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: "walk_left",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 24,
        end: 29,
      }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: "walk_up",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 30,
        end: 35,
      }),
      frameRate: 6,
      repeat: -1,
    });

    // Attack Animations
    scene.anims.create({
      key: "attack_down",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 36,
        end: 39,
      }),
      frameRate: 12,
      repeat: 0,
    });

    scene.anims.create({
      key: "attack_left",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 42,
        end: 45,
      }),
      frameRate: 12,
      repeat: 0,
    });

    scene.anims.create({
      key: "attack_right",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 42,
        end: 45,
      }),
      frameRate: 12,
      repeat: 0,
    });

    scene.anims.create({
      key: "attack_up",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 48,
        end: 51,
      }),
      frameRate: 12,
      repeat: 0,
    });

    // Dying Animation
    scene.anims.create({
      key: "die",
      frames: scene.anims.generateFrameNumbers("player", {
        start: 54,
        end: 56,
      }),
      frameRate: 6,
      repeat: 0,
    });
  }

  getExp() {
    return this.exp;
  }

  updatePosition(position: { x: number; y: number }) {
    this.sprite.x = position.x;
    this.sprite.y = position.y;
    this.label.x = position.x;
    this.label.y = position.y - 15;
  }

  updateExpBar(exp: number, level: number) {
    this.exp = exp;
    this.level = level;
  }

  updateDirection(direction: string) {
    if (direction) {
      if (direction !== this.currentDirection) {
        if (direction === "left") {
          this.sprite.setFlipX(true);
        } else {
          this.sprite.setFlipX(false);
        }
      }
      this.currentDirection = direction;
    }
  }

  updateAction(action: string) {
    this.currentAction = action;
  }

  playAnimation(action: string, direction: string = this.currentDirection) {
    if (this.isAttacking) return;

    let animationKey = "";

    if (action === "idle") {
      animationKey = `idle_${direction}`;
      this.isMoving = false;
    } else if (action === "walk") {
      animationKey = `walk_${direction}`;
      this.isMoving = true;
    } else if (action === "attack") {
      animationKey = `attack_${direction}`;
      this.isAttacking = true;
    } else if (action === "die") {
      animationKey = "die";
    }

    if (animationKey) {
      this.sprite.play(animationKey, true);
    }

    if (action === "attack") {
      this.sprite.once(
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
  }
}

export class LocalPlayer extends Player {
  public expBar: Phaser.GameObjects.Rectangle;
  public levelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, socket: Socket, playerData: PlayerData) {
    super(scene, socket, playerData, true);

    this.levelText = this.scene.add.text(10, 10, `Level: ${this.level}`, {
      fontSize: "16px",
      color: "#fff",
    });

    this.expBar = this.scene.add.rectangle(400, 580, 200, 20, 0x00ff00);
    this.updateExpBar(this.exp, this.level);
  }

  updateExpBar(exp: number, level: number): void {
    super.updateExpBar(exp, level);
    const expPercentage = (exp / (level * 100)) * 200; // Bar width scales with EXP if (this.expBar && this.levelText) {
    this.expBar.width = expPercentage;
    this.expBar.x = 400 - (200 - this.expBar.width) / 2; // Adjust position
    this.levelText.setText(`Level: ${level}`);
  }

  destroy() {
    if (this.expBar) this.expBar.destroy();
    if (this.levelText) this.levelText.destroy();
    super.destroy();
  }
}
