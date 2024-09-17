import { v4 as uuidv4 } from "uuid";
import { Player } from "./Player";

export interface EnemyData {
  id: string;
  position: { x: number; y: number };
  health: number;
  direction: string;
  action: string;
}

export class Enemy {
  id: string;
  position: { x: number; y: number };
  health: number;
  alive: boolean;
  velocity: { x: number; y: number };
  direction: string;
  action: string;
  targetPlayerId: string | null = null;

  constructor() {
    this.id = uuidv4();
    this.position = { x: Math.random() * 800, y: Math.random() * 600 };
    this.health = 100;
    this.alive = true;
    this.velocity = { x: 0, y: 0 };
    this.direction = "down";
    this.action = "idle";
  }

  move(deltaTime: number) {
    if (!this.alive || this.action === "idle") return;

    const deltaSeconds = deltaTime / 1000;

    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;

    // Handle boundary collisions
    if (this.position.x < 0 || this.position.x > 800) this.velocity.x *= -1;
    if (this.position.y < 0 || this.position.y > 600) this.velocity.y *= -1;

    // Clamp position
    this.position.x = Math.max(0, Math.min(800, this.position.x));
    this.position.y = Math.max(0, Math.min(600, this.position.y));
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.action = "die";
      return true; // Indicates the enemy is dead
    }
    return false;
  }

  // New Methods for Behavior
  findTarget(players: { [key: string]: Player }): void {
    if (this.targetPlayerId && players[this.targetPlayerId]?.isAlive) return;

    let closestPlayerId: string | null = null;
    let minDistance = Infinity;
    const detectionRadius = 200;

    for (const playerId in players) {
      const player = players[playerId];
      const distance = this.getDistance(this.position, player.position);
      if (distance < minDistance && distance <= detectionRadius) {
        minDistance = distance;
        closestPlayerId = playerId;
      }
    }

    if (closestPlayerId) {
      this.targetPlayerId = closestPlayerId;
      this.action = "chase";
      this.direction = this.getDirectionTowards(
        players[this.targetPlayerId].position
      );
      this.setVelocity();
    }
  }

  performAction(players: { [key: string]: Player }): void {
    if (this.action === "chase" && this.targetPlayerId) {
      const target = players[this.targetPlayerId];
      if (!target || !target.isAlive) {
        this.targetPlayerId = null;
        this.action = "idle";
        this.velocity = { x: 0, y: 0 };
        return;
      }

      const distance = this.getDistance(this.position, target.position);
      if (distance > 150) {
        // Long Jump
        this.action = "hop";
        setTimeout(() => {
          this.action = "longJump";
          this.direction = this.getDirectionTowards(target.position);
          this.setVelocity();
        }, 500); // Short hop before long jump
      } else {
        // Regular Chase
        this.direction = this.getDirectionTowards(target.position);
        this.setVelocity();
      }
    }
  }

  private setVelocity() {
    if (!this.alive) {
      this.velocity = { x: 0, y: 0 };
      return;
    }

    const speed = this.action === "longJump" ? 150 : 50;
    const angle = this.getAngleFromDirection(this.direction);
    this.velocity.x = Math.cos(angle) * speed;
    this.velocity.y = Math.sin(angle) * speed;
  }

  private getAngleFromDirection(direction: string): number {
    switch (direction) {
      case "left":
        return Math.PI;
      case "right":
        return 0;
      case "up":
        return -Math.PI / 2;
      case "down":
        return Math.PI / 2;
      case "idle":
      default:
        return 0;
    }
  }

  private getDirectionTowards(targetPos: { x: number; y: number }): string {
    const dx = targetPos.x - this.position.x;
    const dy = targetPos.y - this.position.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    } else {
      return dy > 0 ? "down" : "up";
    }
  }

  private getDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
