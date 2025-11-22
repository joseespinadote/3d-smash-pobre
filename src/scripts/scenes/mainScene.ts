import { Scene3D } from '@enable3d/phaser-extension'
import VirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick'
import Player from '../entities/Player'
import Platform from '../entities/Platform'
import ActionButton from '../ui/ActionButton'

export default class MainScene extends Scene3D {
  private joystick!: InstanceType<typeof VirtualJoystick>
  private player!: Player
  private enemies: Player[] = []
  private platforms: Platform[] = []
  private jumpButton!: ActionButton
  private punchButton!: ActionButton

  constructor() {
    super({ key: 'MainScene' })
  }

  init() {
    this.accessThirdDimension()
  }

  create() {
    // Setup camera
    this.third.camera.position.set(0, 15, 20)
    this.third.camera.lookAt(0, 0, 0)

    // Add lighting with warpSpeed
    this.third.warpSpeed('light')

    // Add title text
    const text = this.add.text(
      this.cameras.main.centerX,
      20,
      'Smash Bros del Hombre Pobre',
      {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }
    )
    text.setOrigin(0.5, 0)

    // Create platforms
    this.createPlatforms()

    // Create main player (red cube)
    this.player = new Player({
      scene: this,
      x: 0,
      y: 10,
      z: 0,
      size: 1,
      color: 0xff0000,
      mass: 10,
      jumpForce: 10,
      doubleJumpForce: 6,
      punchForce: 20,
      punchRange: 3
    })

    // Create enemy cubes with different colors
    const enemyColors = [
      { color: 0x0000ff, x: 5, z: 5 },   // Blue
      { color: 0x00ff00, x: -5, z: -5 }, // Green
      { color: 0xffff00, x: 5, z: -5 },  // Yellow
      { color: 0xff00ff, x: -5, z: 5 }   // Magenta
    ]

    enemyColors.forEach((config, index) => {
      const enemy = new Player({
        scene: this,
        x: config.x,
        y: 10,
        z: config.z,
        size: 1,
        color: config.color,
        mass: 10
      })
      this.enemies.push(enemy)
    })

    // Create virtual joystick for movement
    this.joystick = new VirtualJoystick(this, {
      x: 100,
      y: this.cameras.main.height - 100,
      radius: 60,
      base: this.add.circle(0, 0, 60, 0x888888, 0.5),
      thumb: this.add.circle(0, 0, 30, 0xcccccc, 0.8)
    })

    // Create action buttons
    this.createActionButtons()

    // Add controls instructions
    const instructions = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.height - 30,
      'Joystick: Mover | A: Saltar (doble salto) | B: Golpear',
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 }
      }
    )
    instructions.setOrigin(0.5, 1)
  }

  /**
   * Create all platforms in the scene
   */
  private createPlatforms(): void {
    // Main base platform (large)
    const basePlatform = new Platform({
      scene: this,
      x: 0,
      y: 0,
      z: 0,
      width: 20,
      height: 1,
      depth: 20,
      color: 0x4a4a4a
    })
    this.platforms.push(basePlatform)

    // Additional jumping platforms with varied colors
    const platformConfigs = [
      { x: 8, y: 3, z: 8, width: 4, depth: 4, color: 0x8b4513 },   // Brown
      { x: -8, y: 4, z: -8, width: 4, depth: 4, color: 0x2e8b57 }, // Sea green
      { x: 8, y: 5, z: -8, width: 4, depth: 4, color: 0x4169e1 },  // Royal blue
      { x: -8, y: 3, z: 8, width: 4, depth: 4, color: 0x9932cc },  // Dark orchid
      { x: 0, y: 6, z: 0, width: 3, depth: 3, color: 0xff6347 }    // Tomato (center high platform)
    ]

    platformConfigs.forEach(config => {
      const platform = new Platform({
        scene: this,
        x: config.x,
        y: config.y,
        z: config.z,
        width: config.width,
        height: 1,
        depth: config.depth,
        color: config.color
      })
      this.platforms.push(platform)
    })
  }

  /**
   * Create action buttons for jump and punch
   */
  private createActionButtons(): void {
    const screenWidth = this.cameras.main.width
    const screenHeight = this.cameras.main.height

    // Jump button (A)
    this.jumpButton = new ActionButton({
      scene: this,
      x: screenWidth - 150,
      y: screenHeight - 100,
      radius: 50,
      label: 'A',
      color: 0x44ff44,
      alpha: 0.6,
      labelColor: '#ffffff',
      labelSize: 32
    })

    this.jumpButton.onPress(() => {
      this.player.jump()
    })

    // Punch button (B)
    this.punchButton = new ActionButton({
      scene: this,
      x: screenWidth - 50,
      y: screenHeight - 100,
      radius: 50,
      label: 'B',
      color: 0xff4444,
      alpha: 0.6,
      labelColor: '#ffffff',
      labelSize: 32
    })

    this.punchButton.onPress(() => {
      // Punch all enemies
      const allCubes = [...this.enemies]
      this.player.punch(allCubes)
    })
  }

  update(_time: number, delta: number): void {
    // Update player
    this.player.update()

    // Update all enemies
    this.enemies.forEach(enemy => {
      enemy.update()
    })

    // Handle joystick movement
    const force = this.joystick.force
    if (force > 0) {
      const moveX = this.joystick.right ? 1 : this.joystick.left ? -1 : 0
      const moveZ = this.joystick.down ? 1 : this.joystick.up ? -1 : 0
      this.player.move(moveX, moveZ, 5)
    } else {
      // Stop horizontal movement when joystick is released
      this.player.move(0, 0, 0)
    }
  }
}
