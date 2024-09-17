import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.spritesheet("player", "assets/images/player.png", {
      frameWidth: 48,
      frameHeight: 48,
    });
    this.load.spritesheet("slime", "assets/images/slime.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create() {
    Player.createAnimations(this);
    Enemy.createAnimations(this);
    this.scene.start("MainScene");
  }
}
