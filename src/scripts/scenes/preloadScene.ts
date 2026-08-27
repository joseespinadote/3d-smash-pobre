import { Scene3D, THREE } from '@enable3d/phaser-extension'

export default class PreloadScene extends Scene3D {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  init() {
    this.accessThirdDimension()
  }

  async preload() {
    // Enable THREE cache
    THREE.Cache.enabled = true
    
    console.log('Preloading Knight model...')
    try {
      // Load the GLTF model
      const gltf = await this.third.load.gltf('assets/models/Knight.glb')
      if (gltf) {
        // Manually add to THREE.Cache
        THREE.Cache.add('knight', gltf)
        console.log('Knight model preloaded and added to THREE.Cache with key "knight"')
      }
    } catch (err) {
      console.error('Error loading Knight model:', err)
    }
  }

  create() {
    // Small delay to ensure cache is ready
    this.time.delayedCall(100, () => {
      this.scene.start('MainScene')
    })
  }
}
