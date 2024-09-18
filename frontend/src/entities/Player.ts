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
  protected label: Phaser.GameObjects.Text;
  protected exp: number;
  protected level: number;
  protected isMoving: boolean = false;
  protected isAttacking: boolean = false;
  public sprite: Phaser.GameObjects.Sprite;
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

    this.sprite = this.scene.physics.add.sprite(
      Math.round(playerData.position.x),
      Math.round(playerData.position.y),
      "player"
    );
    this.sprite.setScale(1);
    this.sprite.play(`idle_right`);

    this.label = this.scene.add
      .text(
        this.sprite.x,
        this.sprite.y - 15,
        `${this.playerId.slice(0, 6)}` + (isLocal ? " (you)" : ""),
        {
          fontSize: "8px",
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
    this.sprite.x = Phaser.Math.Interpolation.Linear(
      [this.sprite.x, position.x],
      0.9
    );
    this.sprite.y = Phaser.Math.Interpolation.Linear(
      [this.sprite.y, position.y],
      0.9
    );
    this.label.x = Phaser.Math.Interpolation.Linear(
      [this.label.x, position.x],
      0.7
    );
    this.label.y = Phaser.Math.Interpolation.Linear(
      [this.label.y, position.y - 15],
      0.7
    );
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
      // Check if the desired animation is already playing
      if (
        this.sprite.anims.isPlaying &&
        this.sprite.anims.currentAnim?.key === animationKey
      ) {
        // Desired animation is already playing; do nothing
        return;
      }

      this.sprite.play(animationKey, true);

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
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
  }
}

export class LocalPlayer extends Player {
  public uiContainer: Phaser.GameObjects.Container;
  public expBarBackground: Phaser.GameObjects.Rectangle;
  public expBarFill: Phaser.GameObjects.Rectangle;
  public expLabel: Phaser.GameObjects.Text;
  public levelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, socket: Socket, playerData: PlayerData) {
    super(scene, socket, playerData, true);

    // Create a container for UI elements
    this.uiContainer = this.scene.add.container(140, 110).setScrollFactor(0);

    // Initialize Level Text
    this.levelText = this.scene.add
      .text(0, 0, `Level: ${this.level}`, {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 5, y: 5 },
      })
      .setOrigin(0, 0);

    this.uiContainer.add(this.levelText);

    const padding = 10;
    const levelTextWidth = this.levelText.width;

    // EXP Bar Background
    this.expBarBackground = this.scene.add
      .rectangle(levelTextWidth + padding, 4, 200, 12, 0x808080)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xffffff);
    this.uiContainer.add(this.expBarBackground);

    // EXP Bar Fill
    this.expBarFill = this.scene.add
      .rectangle(
        levelTextWidth + padding + 2,
        6,
        (196 * this.calculateExpPercentage()) / 100,
        8,
        0x00ff00
      )
      .setOrigin(0, 0);
    this.uiContainer.add(this.expBarFill);

    // EXP Label
    this.expLabel = this.scene.add
      .text(
        levelTextWidth + padding + 100,
        22,
        `${this.exp}/${this.level * 100} (${this.calculateExpPercentage()}%)`,
        {
          fontSize: "10px",
          color: "#ffffff",
          fontStyle: "bold",
          backgroundColor: "#000000",
          padding: { x: 5, y: 0 },
        }
      )
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    this.uiContainer.add(this.expLabel);
  }

  private calculateExpPercentage(): number {
    return Math.min(Math.floor((this.exp / (this.level * 100)) * 100), 100);
  }

  updateExpBar(exp: number, level: number): void {
    super.updateExpBar(exp, level);

    // Update Level Text
    this.levelText.setText(`Level: ${level}`);

    // Update EXP Fill Width
    const expPercentage = this.calculateExpPercentage();
    this.expBarFill.width = 196 * (expPercentage / 100);

    // Update EXP Label
    this.expLabel.setText(
      `${this.exp}/${this.level * 100} (${this.calculateExpPercentage()}%)`
    );
  }

  destroy() {
    this.uiContainer.destroy();
    super.destroy();
  }
}
