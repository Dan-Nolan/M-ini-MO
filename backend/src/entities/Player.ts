import { ObjectId } from "mongodb";
import { TICK_RATE } from "../server";
import { MapLoader } from "../MapLoader";

export interface PlayerData {
  playerId: string;
  position: { x: number; y: number };
  level: number;
  exp: number;
  health: number;
  socketId: string;
  direction: string;
  action: string;
}

export interface PlayerDocument extends PlayerData {
  _id: ObjectId;
}

export class Player {
  playerId: string;
  position: { x: number; y: number };
  level: number;
  exp: number;
  health: number;
  socketId: string;
  direction: string;
  action: string;
  isAlive: boolean = true;
  speed: number = 60;

  // Store the latest input from the client
  currentInput: Partial<{
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    direction: string;
    action: string;
  }> = {};

  constructor(data: PlayerData) {
    this.playerId = data.playerId;
    this.position = data.position;
    this.level = data.level;
    this.exp = data.exp;
    this.health = data.health;
    this.socketId = data.socketId;
    this.direction = data.direction;
    this.action = data.action;
  }

  // Update the stored input
  setInput(
    input: Partial<{
      left: boolean;
      right: boolean;
      up: boolean;
      down: boolean;
      direction: string;
      action: string;
    }>
  ) {
    // multiple player inputs can come in, so remember if its an attack
    // this is not super elegant, may be a better way to rework this
    const prev = this.currentInput;
    this.currentInput = input;
    if (prev?.action === "attack") {
      this.currentInput.action = "attack";
    }
  }

  isAttacking(): boolean {
    return this.currentInput.action === "attack";
  }

  // Process the stored input
  processInput(mapLoader: MapLoader): void {
    const input = this.currentInput;

    // Store potential new position
    const newPosition = { ...this.position };

    if (input.left) newPosition.x -= this.speed / TICK_RATE;
    if (input.right) newPosition.x += this.speed / TICK_RATE;
    if (input.up) newPosition.y -= this.speed / TICK_RATE;
    if (input.down) newPosition.y += this.speed / TICK_RATE;

    // Check for collisions before updating position
    if (
      !mapLoader.isTileBlocked(
        Math.floor(newPosition.x / 16),
        Math.floor(newPosition.y / 16)
      )
    ) {
      this.position = newPosition; // Update position only if no collision
    }

    if (input.direction) {
      this.direction = input.direction;
    }

    if (input.action) {
      this.action = input.action;
    }

    // Clamp position
    const spriteSize = 32;
    const halfSpriteSize = spriteSize / 2;
    this.position.x = Math.max(0, Math.min(768, this.position.x));
    this.position.y = Math.max(
      -halfSpriteSize,
      Math.min(512 - halfSpriteSize, this.position.y)
    );

    // Reset current input after processing
    this.currentInput = {};
  }

  gainExp(amount: number): boolean {
    this.exp += amount;
    if (this.exp >= this.level * 100) {
      this.exp -= this.level * 100;
      this.level += 1;
      return true; // Indicates level up
    }
    return false;
  }
}
