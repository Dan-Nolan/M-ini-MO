import { ObjectId } from "mongodb";

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

  // Process the stored input
  processInput(speed: number): void {
    const input = this.currentInput;

    if (input.left) this.position.x -= speed;
    if (input.right) this.position.x += speed;
    if (input.up) this.position.y -= speed;
    if (input.down) this.position.y += speed;

    if (input.direction) {
      this.direction = input.direction;
    }

    if (input.action) {
      this.action = input.action;
    }

    // Clamp position
    this.position.x = Math.max(0, Math.min(800, this.position.x));
    this.position.y = Math.max(0, Math.min(600, this.position.y));

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
