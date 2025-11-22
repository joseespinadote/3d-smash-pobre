import { ExtendedObject3D } from '@enable3d/phaser-extension'

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
}

export default class Platform {
  private scene: any
  private mesh: ExtendedObject3D
  private width: number
  private height: number
  private depth: number

  constructor(config: PlatformConfig) {
    this.scene = config.scene
    this.width = config.width || 10
    this.height = config.height || 1
    this.depth = config.depth || 10

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
    this.mesh.body.setFriction(0.9)

    // Make static (platforms don't move)
    if (config.isStatic !== false) {
      this.mesh.body.setCollisionFlags(2) // Kinematic/static object
    }
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
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
