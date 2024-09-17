import { v4 as uuidv4 } from "uuid";

export interface EnemyData {
  id: string;
  position: { x: number; y: number };
  health: number;
}

export class Enemy {
  id: string;
  position: { x: number; y: number };
  health: number;
  alive: boolean;
  velocity: { x: number; y: number };

  constructor() {
    this.id = uuidv4();
    this.position = { x: Math.random() * 800, y: Math.random() * 600 };
    this.health = 100;
    this.alive = true;
    this.velocity = { x: 0, y: 0 };
    this.changeDirection();
  }

  changeDirection() {
    if (!this.alive) return;

    const speed = 50; // Adjust speed as needed
    const angle = Math.random() * 2 * Math.PI;
    this.velocity.x = Math.cos(angle) * speed;
    this.velocity.y = Math.sin(angle) * speed;

    setTimeout(() => this.changeDirection(), 2000 + Math.random() * 3000); // Change direction every 2-5 seconds
  }

  move(deltaTime: number) {
    if (!this.alive) return;

    const deltaSeconds = deltaTime / 1000;

    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;

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
      return true; // Indicates the enemy is dead
    }
    return false;
  }
}
