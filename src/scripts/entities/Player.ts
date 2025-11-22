import { ExtendedObject3D, THREE } from '@enable3d/phaser-extension'

export interface PlayerConfig {
  scene: any
  x: number
  y: number
  z: number
  size?: number
  color?: number
  mass?: number
  jumpForce?: number
  doubleJumpForce?: number
  punchForce?: number
  punchRange?: number
  isAI?: boolean
}

export interface AIConfig {
  detectionRange?: number
  attackRange?: number
  moveSpeed?: number
  aggressiveness?: number
}

export default class Player {
  private scene: any
  private mesh: ExtendedObject3D
  private size: number
  private jumpForce: number
  private doubleJumpForce: number
  private punchForce: number
  private punchRange: number
  private canDoubleJump: boolean = false
  private isGrounded: boolean = false
  private spawnPosition: THREE.Vector3

  // Movement tracking
  private lastMoveDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  private isMoving: boolean = false

  // AI properties
  private isAI: boolean = false
  private aiDetectionRange: number = 15
  private aiAttackRange: number = 3
  private aiMoveSpeed: number = 5
  private aiAggressiveness: number = 0.8
  private aiThinkTimer: number = 0
  private aiThinkInterval: number = 500 // ms
  private aiCurrentTarget: Player | null = null
  private aiLastPunchTime: number = 0
  private aiPunchCooldown: number = 1000 // ms

  constructor(config: PlayerConfig) {
    this.scene = config.scene
    this.size = config.size || 1
    this.jumpForce = config.jumpForce || 8
    this.doubleJumpForce = config.doubleJumpForce || 5
    this.punchForce = config.punchForce || 15
    this.punchRange = config.punchRange || 3
    this.isAI = config.isAI || false

    this.spawnPosition = new THREE.Vector3(config.x, config.y, config.z)

    // Create the player mesh with physics
    this.mesh = this.scene.third.physics.add.box(
      {
        x: config.x,
        y: config.y,
        z: config.z,
        width: this.size,
        height: this.size,
        depth: this.size
      },
      {
        lambert: { color: config.color || 0xff0000 }
      }
    )

    // Set physics properties
    this.mesh.body.setFriction(0.8)
    this.mesh.body.setAngularFactor(0, 0, 0) // Prevent rotation
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
  }

  /**
   * Move the player in the X-Z plane
   */
  move(x: number, z: number, speed: number = 5): void {
    if (!this.mesh.body) return

    const velocity = this.mesh.body.velocity
    this.mesh.body.setVelocity(x * speed, velocity.y, z * speed)

    // Track movement direction for punch momentum
    if (x !== 0 || z !== 0) {
      this.lastMoveDirection.set(x, 0, z).normalize()
      this.isMoving = true
    } else {
      this.isMoving = false
    }
  }

  /**
   * Make the player jump (supports double jump)
   */
  jump(): void {
    if (!this.mesh.body) return

    if (this.isGrounded) {
      // First jump
      this.mesh.body.setVelocityY(this.jumpForce)
      this.canDoubleJump = true
      this.isGrounded = false
    } else if (this.canDoubleJump) {
      // Double jump
      const currentVelocity = this.mesh.body.velocity
      this.mesh.body.setVelocity(
        currentVelocity.x,
        this.doubleJumpForce,
        currentVelocity.z
      )
      this.canDoubleJump = false
    }
  }

  /**
   * Punch nearby objects - pushes them in the direction the attacker was moving
   * Much stronger horizontal push to knock enemies off platforms
   */
  punch(enemies: Player[]): void {
    if (!this.mesh) return

    const playerPos = this.mesh.position
    let hitSomething = false

    enemies.forEach(enemy => {
      const enemyPos = enemy.getPosition()
      const distance = playerPos.distanceTo(enemyPos)

      if (distance < this.punchRange && enemy !== this) {
        let punchDirection = new THREE.Vector3()

        // Use the direction the attacker was moving for more realistic punch
        if (this.lastMoveDirection.length() > 0.1) {
          // Punch in the direction we're moving
          punchDirection.copy(this.lastMoveDirection)
        } else {
          // Fallback: punch from player to enemy if not moving
          punchDirection.subVectors(enemyPos, playerPos)
          punchDirection.y = 0 // Keep it horizontal
          punchDirection.normalize()
        }

        // Much stronger horizontal force to really knock enemies off platforms
        const horizontalForce = this.punchForce * 5.0 // 5x multiplier = 100 force!
        const upwardForce = this.punchForce * 0.5     // Small upward boost

        enemy.applyForce(
          punchDirection.x * horizontalForce,
          upwardForce,
          punchDirection.z * horizontalForce
        )

        // Show hit effect on the enemy
        this.showPunchEffect(enemyPos)
        hitSomething = true
      }
    })

    // Show punch effect on self if we punched (even if missed)
    if (hitSomething) {
      this.flashColor(0xffff00) // Yellow flash when hitting
    }
  }

  /**
   * Apply force to the player
   */
  applyForce(x: number, y: number, z: number): void {
    if (!this.mesh.body) return
    this.mesh.body.applyForce(x, y, z)
  }

  /**
   * Update player state (call this every frame)
   */
  update(delta: number = 16, allPlayers: Player[] = []): void {
    if (!this.mesh.body) return

    // Check if player is grounded
    const velocity = this.mesh.body.velocity
    if (Math.abs(velocity.y) < 0.1 && this.mesh.position.y < 10) {
      this.isGrounded = true
      this.canDoubleJump = false
    }

    // Check if player fell off the map
    if (this.mesh.position.y < -20) {
      this.respawn()
    }

    // Update AI
    if (this.isAI && allPlayers.length > 0) {
      this.updateAI(delta, allPlayers)
    }
  }

  /**
   * Respawn player at spawn position
   */
  respawn(): void {
    if (!this.mesh.body) return

    this.mesh.position.set(
      this.spawnPosition.x,
      this.spawnPosition.y,
      this.spawnPosition.z
    )
    this.mesh.body.needUpdate = true
    this.mesh.body.setVelocity(0, 0, 0)
    this.mesh.body.setAngularVelocity(0, 0, 0)
    this.isGrounded = false
    this.canDoubleJump = false
  }

  /**
   * Get player position
   */
  getPosition(): THREE.Vector3 {
    return this.mesh.position
  }

  /**
   * Get the mesh object
   */
  getMesh(): ExtendedObject3D {
    return this.mesh
  }

  /**
   * Set spawn position
   */
  setSpawnPosition(x: number, y: number, z: number): void {
    this.spawnPosition.set(x, y, z)
  }

  /**
   * Check if this player is AI controlled
   */
  getIsAI(): boolean {
    return this.isAI
  }

  /**
   * AI Update logic
   */
  private updateAI(delta: number, allPlayers: Player[]): void {
    this.aiThinkTimer += delta

    // AI "thinks" at intervals
    if (this.aiThinkTimer >= this.aiThinkInterval) {
      this.aiThinkTimer = 0
      this.aiThink(allPlayers)
    }

    // Execute current AI behavior
    this.aiExecute(allPlayers)
  }

  /**
   * AI decision making
   */
  private aiThink(allPlayers: Player[]): void {
    // Find the nearest player (including human player and other AI)
    let nearestPlayer: Player | null = null
    let nearestDistance = Infinity

    allPlayers.forEach(player => {
      if (player === this) return // Don't target self

      const distance = this.mesh.position.distanceTo(player.getPosition())

      if (distance < this.aiDetectionRange && distance < nearestDistance) {
        nearestDistance = distance
        nearestPlayer = player
      }
    })

    this.aiCurrentTarget = nearestPlayer
  }

  /**
   * Execute AI behavior
   */
  private aiExecute(allPlayers: Player[]): void {
    if (!this.aiCurrentTarget) return

    const myPos = this.mesh.position
    const targetPos = this.aiCurrentTarget.getPosition()
    const distance = myPos.distanceTo(targetPos)

    // If target is out of range, find new target
    if (distance > this.aiDetectionRange) {
      this.aiCurrentTarget = null
      this.move(0, 0, 0) // Stop moving
      return
    }

    // Calculate direction to target
    const direction = new THREE.Vector3()
      .subVectors(targetPos, myPos)
      .normalize()

    // Move towards target
    if (distance > this.aiAttackRange) {
      this.move(direction.x, direction.z, this.aiMoveSpeed)

      // Jump if target is higher and we're on the ground
      if (targetPos.y > myPos.y + 2 && this.isGrounded) {
        if (Math.random() < this.aiAggressiveness) {
          this.jump()
        }
      }
    } else {
      // We're in attack range
      this.move(0, 0, 0) // Stop moving

      // Try to punch
      const currentTime = Date.now()
      if (currentTime - this.aiLastPunchTime > this.aiPunchCooldown) {
        if (Math.random() < this.aiAggressiveness) {
          this.punch(allPlayers)
          this.aiLastPunchTime = currentTime
        }
      }

      // Sometimes jump while attacking (aerial combat)
      if (Math.random() < 0.3 && this.isGrounded) {
        this.jump()
      }
    }
  }

  /**
   * Configure AI behavior
   */
  configureAI(config: AIConfig): void {
    if (config.detectionRange !== undefined) {
      this.aiDetectionRange = config.detectionRange
    }
    if (config.attackRange !== undefined) {
      this.aiAttackRange = config.attackRange
    }
    if (config.moveSpeed !== undefined) {
      this.aiMoveSpeed = config.moveSpeed
    }
    if (config.aggressiveness !== undefined) {
      this.aiAggressiveness = Math.max(0, Math.min(1, config.aggressiveness))
    }
  }

  /**
   * Show visual effect when punching (impact point)
   */
  private showPunchEffect(position: THREE.Vector3): void {
    // Create a bright sphere at impact point
    const effect = this.scene.third.add.sphere(
      {
        x: position.x,
        y: position.y,
        z: position.z,
        radius: 0.5
      },
      {
        lambert: { color: 0xffaa00, transparent: true, opacity: 0.8 }
      }
    )

    // Make it glow/emit light
    effect.castShadow = false

    // Remove after short delay
    setTimeout(() => {
      this.scene.third.destroy(effect)
    }, 150)
  }

  /**
   * Flash the player's color briefly
   */
  private flashColor(color: number): void {
    const mesh = this.mesh as any
    if (!mesh.material) return

    // Store original color
    const originalColor = mesh.material.color ? mesh.material.color.getHex() : 0xffffff

    // Change to flash color
    if (mesh.material.color) {
      mesh.material.color.setHex(color)
    }

    // Restore original color after brief delay
    setTimeout(() => {
      if (mesh.material && mesh.material.color) {
        mesh.material.color.setHex(originalColor)
      }
    }, 100)
  }
}
