import { ExtendedObject3D, THREE } from '@enable3d/phaser-extension'

const punchMultiplier = 1 // Multiplier for punch force to make it more impactful

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

  // Knockback state
  private isKnockedBack: boolean = false
  private knockbackEndTime: number = 0
  private knockbackDuration: number = 800 // 0.8 seconds in milliseconds (reduced from 2.5s)

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

  private isRespawning: boolean = false

  constructor(config: PlayerConfig) {
    this.scene = config.scene
    this.size = config.size || 1
    this.jumpForce = config.jumpForce || 8
    this.doubleJumpForce = config.doubleJumpForce || 5
    this.punchForce = config.punchForce || 10 // Reduced from 15
    this.punchRange = config.punchRange || 3
    this.isAI = config.isAI || false

    this.spawnPosition = new THREE.Vector3(config.x, config.y, config.z)

    // Try to get preloaded Knight model from global THREE cache
    const knight = THREE.Cache.get('knight')
    console.log('Player constructor: "knight" model in THREE.Cache?', !!knight)
    
    if (knight) {
      console.log('Knight object keys:', Object.keys(knight))
      
      // Defensively get the scene/model
      // If it's a GLTF result, use .scene. If it's already a Group/Mesh, use it directly.
      const modelSource = knight.scene || knight
      
      if (typeof modelSource.clone !== 'function') {
        console.error('Knight model source is not clonable!', modelSource)
      }

      // Create the player mesh from GLTF model
      const object = modelSource.clone()
      this.mesh = new ExtendedObject3D()
      this.mesh.add(object)
      this.mesh.position.set(config.x, config.y, config.z)
      
      // Scaling can be tricky with GLB models. 0.01 - 0.1 is very common.
      // Adjusting to a size that's clearly visible.
      this.mesh.scale.set(this.size * 2, this.size * 2, this.size * 2)
      
      // Add to scene
      this.scene.third.add.existing(this.mesh)
      
      // Add physics
      this.scene.third.physics.add.existing(this.mesh, {
        shape: 'box',
        width: this.size * 0.8,
        height: this.size * 1.8,
        depth: this.size * 0.8,
        offset: { y: -0.1 }
      })

      // Setup animations
      if (knight.animations && knight.animations.length > 0) {
        knight.animations.forEach((clip: any) => {
          this.mesh.anims.add(clip.name, clip)
        })
        
        // Some models name it 'idle', others 'Idle', 'Animation', etc.
        // Try 'Idle' first, then fallback to the first animation
        const idleAnim = knight.animations.find((a: any) => a.name === 'Idle' || a.name === 'idle')
        if (idleAnim) {
          this.mesh.anims.play(idleAnim.name)
        } else {
          this.mesh.anims.play(knight.animations[0].name)
        }
      }

      // Apply color to the model if possible (e.g. by coloring the mesh materials)
      if (config.color) {
        this.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // Only apply color if it's not the skin/texture (optional)
            // child.material.color.setHex(config.color)
          }
        })
      }
    } else {
      // Fallback: Create the player mesh as a box if model is not loaded
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
    }

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

    // Cannot move while knocked back
    if (this.isKnockedBack) return

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

    // Cannot jump while knocked back
    if (this.isKnockedBack) return

    if (this.isGrounded) {
      // First jump
      this.mesh.body.setVelocityY(this.jumpForce)
      this.canDoubleJump = true
      this.isGrounded = false
    } else if (this.canDoubleJump) {
      // Double jump
      const currentVelocity = this.mesh.body.velocity
      this.mesh.body.setVelocity(currentVelocity.x, this.doubleJumpForce, currentVelocity.z)
      this.canDoubleJump = false
    }
  }

  /**
   * Punch nearby objects - pushes them in the direction the attacker was moving
   * Creates a projectile trajectory for the knocked back enemy
   */
  punch(enemies: Player[]): void {
    if (!this.mesh) return

    // Cannot punch while knocked back
    if (this.isKnockedBack) return

    const playerPos = this.mesh.position
    let hitSomething = false

    enemies.forEach((enemy) => {
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

        // Create projectile trajectory: strong horizontal force + moderate upward force
        // This creates a parabolic arc where the enemy flies backwards
        const horizontalForce = this.punchForce * punchMultiplier * 0.7 // Reduced from 1.5
        const upwardForce = this.punchForce * 0.4 // Reduced from 0.6

        // Apply force in a projectile trajectory
        enemy.applyForce(
          punchDirection.x * horizontalForce,
          upwardForce,
          punchDirection.z * horizontalForce
        )

        // Put enemy in knockback state (stunned, can't control for 0.8 seconds)
        enemy.setKnockedBack()

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
   * Put player in knockback state (can't control movement)
   */
  setKnockedBack(): void {
    this.isKnockedBack = true
    this.knockbackEndTime = Date.now() + this.knockbackDuration

    // Visual feedback: flash red when knocked back
    this.flashColor(0xff0000)
  }

  /**
   * Update player state (call this every frame)
   */
  update(delta: number = 16, allPlayers: Player[] = []): void {
    if (!this.mesh.body) return

    // Check if knockback has expired
    if (this.isKnockedBack && Date.now() >= this.knockbackEndTime) {
      this.isKnockedBack = false
    }

    // Check if player is grounded
    const velocity = this.mesh.body.velocity
    if (Math.abs(velocity.y) < 0.1 && this.mesh.position.y < 10) {
      this.isGrounded = true
      this.canDoubleJump = false
    }

    // Update animations if it's a model
    if (this.mesh.anims) {
      if (this.isKnockedBack) {
        // You could play a 'Hit' animation here if available
      } else if (!this.isGrounded) {
        // You could play a 'Jump' or 'Fall' animation
      } else if (this.isMoving) {
        this.mesh.anims.play('Run')
      } else {
        this.mesh.anims.play('Idle')
      }
    }

    // Rotate model to face movement direction
    if (this.isMoving && !this.isKnockedBack) {
      const angle = Math.atan2(this.lastMoveDirection.x, this.lastMoveDirection.z)
      this.mesh.rotation.y = angle
    }

    // Check if player fell off the map (Main platform is at y=0, height 1)
    if (this.mesh.position.y < -10 && !this.isRespawning) {
      this.die()
    }

    // Update AI (only if not knocked back)
    if (this.isAI && !this.isKnockedBack && allPlayers.length > 0) {
      this.updateAI(delta, allPlayers)
    }
  }

  /**
   * Handle player death: explode and respawn
   */
  die(): void {
    if (!this.mesh.body || this.isRespawning) return

    this.isRespawning = true

    // Show explosion effect at current position
    this.showExplosionEffect(this.mesh.position)
    
    // Immediate respawn
    this.respawn()
  }

  /**
   * Show explosion effect with small particles
   */
  private showExplosionEffect(position: THREE.Vector3): void {
    const particleCount = 12
    let color = 0xff0000 // Default red

    // Try to get color from mesh or its children
    this.mesh.traverse((child: any) => {
      if (child.isMesh && child.material && child.material.color) {
        color = child.material.color.getHex()
      }
    })

    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.third.add.sphere(
        {
          x: position.x,
          y: position.y,
          z: position.z,
          radius: 0.2
        },
        {
          lambert: { color: color }
        }
      )

      // Add velocity to particles
      const vx = (Math.random() - 0.5) * 0.4
      const vy = (Math.random() - 0.5) * 0.4
      const vz = (Math.random() - 0.5) * 0.4

      this.scene.time.addEvent({
        delay: 16,
        repeat: 30,
        callback: () => {
          if (particle && particle.position) {
            particle.position.x += vx
            particle.position.y += vy
            particle.position.z += vz
            particle.scale.multiplyScalar(0.92)
          }
        }
      })

      this.scene.time.delayedCall(500, () => {
        this.scene.third.destroy(particle)
      })
    }
  }

  /**
   * Respawn player at spawn position (above center platform)
   */
  respawn(): void {
    if (!this.mesh.body) return

    // 1. Teleport safely: change to kinematic (2), move, then back to dynamic (0)
    // This is the most robust way to teleport dynamic bodies in enable3d/ammo.js
    this.mesh.body.setCollisionFlags(2)
    
    // Set position
    this.mesh.position.set(0, 15, 0)
    this.mesh.body.needUpdate = true
    
    // 2. Reset all physics velocities
    this.mesh.body.setVelocity(0, 0, 0)
    this.mesh.body.setAngularVelocity(0, 0, 0)
    
    // 3. Reset all gameplay flags
    this.isGrounded = false
    this.canDoubleJump = false
    this.isKnockedBack = false
    this.lastMoveDirection.set(0, 0, 0)
    this.isMoving = false

    // Reset animations if it's a model
    if (this.mesh.anims) {
      this.mesh.anims.play('Idle')
    }

    // 4. Return to dynamic state in the next frame to ensure the position is set
    this.scene.time.delayedCall(50, () => {
      if (this.mesh.body) {
        this.mesh.body.setCollisionFlags(0)
        this.mesh.body.setVelocity(0, 0, 0)
        this.mesh.body.setAngularVelocity(0, 0, 0)
      }
    })

    // 5. Allow death detection again after a delay
    this.scene.time.delayedCall(500, () => {
      this.isRespawning = false
    })
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

    allPlayers.forEach((player) => {
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
    const direction = new THREE.Vector3().subVectors(targetPos, myPos).normalize()

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
    const originalColors: Map<any, number> = new Map()

    // Store original colors and set flash color
    this.mesh.traverse((child: any) => {
      if (child.isMesh && child.material && child.material.color) {
        originalColors.set(child, child.material.color.getHex())
        child.material.color.setHex(color)
      }
    })

    // Restore original colors after brief delay
    setTimeout(() => {
      originalColors.forEach((originalColor, child) => {
        if (child.material && child.material.color) {
          child.material.color.setHex(originalColor)
        }
      })
    }, 100)
  }
}
