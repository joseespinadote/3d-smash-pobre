import { Scene3D, THREE } from '@enable3d/phaser-extension'

export default class PreloadScene extends Scene3D {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  init() {
    this.accessThirdDimension()
  }

  private showLogo(): void {
    if (this.children.getByName('game-logo')) return
    if (!this.textures.exists('logo')) return

    const { centerX, centerY } = this.cameras.main
    const logo = this.add.image(centerX, centerY - 20, 'logo')
    logo.setName('game-logo')
    logo.setOrigin(0.5)

    const maxWidth = this.cameras.main.width * 0.7
    const maxHeight = this.cameras.main.height * 0.5
    const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1)
    logo.setScale(scale)

    const loadingText = this.add.text(centerX, centerY + (logo.height * scale) / 2 + 25, 'Cargando...', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    loadingText.setName('loading-text')
    loadingText.setOrigin(0.5)
  }

  async preload() {
    // Load and show logo
    this.load.image('logo', 'assets/img/logo.png')
    this.load.once('filecomplete-image-logo', () => this.showLogo())

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
    this.showLogo()
    // Small delay to ensure cache is ready and logo is appreciated
    this.time.delayedCall(500, () => {
      this.scene.start('MainScene')
    })
  }
}
