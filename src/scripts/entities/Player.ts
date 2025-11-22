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

  constructor(config: PlayerConfig) {
    this.scene = config.scene
    this.size = config.size || 1
    this.jumpForce = config.jumpForce || 8
    this.doubleJumpForce = config.doubleJumpForce || 5
    this.punchForce = config.punchForce || 15
    this.punchRange = config.punchRange || 3

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
   * Punch nearby objects
   */
  punch(enemies: Player[]): void {
    if (!this.mesh) return

    const playerPos = this.mesh.position

    enemies.forEach(enemy => {
      const enemyPos = enemy.getPosition()
      const distance = playerPos.distanceTo(enemyPos)

      if (distance < this.punchRange && enemy !== this) {
        // Calculate direction from player to enemy
        const direction = new THREE.Vector3()
          .subVectors(enemyPos, playerPos)
          .normalize()

        // Apply force to enemy
        const force = direction.multiplyScalar(this.punchForce)
        enemy.applyForce(force.x, force.y + 3, force.z) // Add upward force
      }
    })
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
  update(): void {
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
}
