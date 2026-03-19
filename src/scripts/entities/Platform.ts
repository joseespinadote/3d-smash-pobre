import { ExtendedObject3D, THREE } from '@enable3d/phaser-extension'

export interface PlatformConfig {
  scene: any
  x: number
  y: number
  z: number
  width?: number
  height?: number
  depth?: number
  color?: number
  mass?: number
  isStatic?: boolean
  moveDistance?: number
  moveSpeed?: number
  moveAxis?: 'x' | 'y' | 'z'
}

export default class Platform {
  private scene: any
  private mesh: ExtendedObject3D
  private width: number
  private height: number
  private depth: number
  
  // Movement properties
  private initialPosition: THREE.Vector3
  private moveDistance: number
  private moveSpeed: number
  private moveAxis: 'x' | 'y' | 'z'
  private time: number = Math.random() * Math.PI * 2 // Random start phase

  constructor(config: PlatformConfig) {
    this.scene = config.scene
    this.width = config.width || 10
    this.height = config.height || 1
    this.depth = config.depth || 10
    
    this.initialPosition = new THREE.Vector3(config.x, config.y, config.z)
    this.moveDistance = config.moveDistance || 0
    this.moveSpeed = config.moveSpeed || 0
    this.moveAxis = config.moveAxis || 'x'

    // Create platform mesh with physics
    this.mesh = this.scene.third.physics.add.box(
      {
        x: config.x,
        y: config.y,
        z: config.z,
        width: this.width,
        height: this.height,
        depth: this.depth
      },
      {
        lambert: { color: config.color || 0x808080 }
      }
    )

    // Set physics properties
    this.mesh.body.setFriction(2) // Increased friction to help moving players

    // Make static or kinematic
    if (config.isStatic !== false) {
      if (this.moveDistance > 0) {
        // Kinematic for moving platforms (collisionFlags 2)
        this.mesh.body.setCollisionFlags(2)
      } else {
        // Static for non-moving
        this.mesh.body.setCollisionFlags(2)
      }
    }
    
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
  }

  /**
   * Update platform position (oscillatory movement)
   */
  update(delta: number = 16): void {
    if (this.moveDistance === 0 || !this.mesh.body) return

    const prevTime = this.time
    this.time += (delta / 1000) * this.moveSpeed
    
    // Calculate new position
    const offset = Math.sin(this.time) * this.moveDistance
    const prevOffset = Math.sin(prevTime) * this.moveDistance
    
    // Calculate velocity needed to reach next position
    // velocity = distance / time
    const vel = ((offset - prevOffset) * 1000) / delta

    if (this.moveAxis === 'x') {
      this.mesh.body.setVelocityX(vel)
    } else if (this.moveAxis === 'y') {
      this.mesh.body.setVelocityY(vel)
    } else if (this.moveAxis === 'z') {
      this.mesh.body.setVelocityZ(vel)
    }
    
    this.mesh.body.needUpdate = true
  }

  /**
   * Get the mesh object
   */
  getMesh(): ExtendedObject3D {
    return this.mesh
  }

  /**
   * Get platform dimensions
   */
  getDimensions(): { width: number; height: number; depth: number } {
    return {
      width: this.width,
      height: this.height,
      depth: this.depth
    }
  }

  /**
   * Set platform color
   */
  setColor(color: number): void {
    const mesh = this.mesh as any
    if (mesh.material) {
      if (mesh.material instanceof Array) {
        mesh.material.forEach((mat: any) => {
          if (mat.color) mat.color.setHex(color)
        })
      } else {
        if (mesh.material.color) mesh.material.color.setHex(color)
      }
    }
  }
}
