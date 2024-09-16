import Phaser from "phaser";
import { Player } from "../entities/Player";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.spritesheet("player", "assets/images/player.png", {
      frameWidth: 48, // Updated frame width
      frameHeight: 48, // Updated frame height
    });
    // Load other assets here
  }

  create() {
    Player.createAnimations(this);
    this.scene.start("MainScene");
  }
}
