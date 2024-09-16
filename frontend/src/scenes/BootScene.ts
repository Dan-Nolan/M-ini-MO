import Phaser from "phaser";
import { Player } from "../entities/Player";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.spritesheet("warrior", "assets/images/Warrior_Blue.png", {
      frameWidth: 1152 / 6,
      frameHeight: 1536 / 8,
    });
    // Load other assets here
  }

  create() {
    Player.createAnimations(this);
    this.scene.start("MainScene");
  }
}
