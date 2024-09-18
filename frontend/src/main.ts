import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MainScene } from "./scenes/MainScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: "game-container",
  roundPixels: true,
  physics: {
    default: "arcade",
  },
  scene: [BootScene, MainScene],
};

export const game = new Phaser.Game(config);
