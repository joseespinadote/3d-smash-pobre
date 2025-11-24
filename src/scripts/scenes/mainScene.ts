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
    this.third.camera.position.set(0, 15, 20)
    this.third.camera.lookAt(0, 0, 0)
    this.third.warpSpeed('light')

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

    // Create enemy cubes with different colors and AI
    const enemyColors = [
      { color: 0x0000ff, x: 5, z: 5 }, // Blue
      { color: 0x00ff00, x: -5, z: -5 }, // Green
      { color: 0xffff00, x: 5, z: -5 }, // Yellow
      { color: 0xff00ff, x: -5, z: 5 } // Magenta
    ]

    enemyColors.forEach((config, index) => {
      const enemy = new Player({
        scene: this,
        x: config.x,
        y: 10,
        z: config.z,
        size: 1,
        color: config.color,
        mass: 10,
        isAI: true // Enable AI
      })

      // Configure AI with slightly different behaviors for variety
      enemy.configureAI({
        detectionRange: 15,
        attackRange: 3,
        moveSpeed: 4 + Math.random() * 2, // Random speed between 4-6
        aggressiveness: 0.6 + Math.random() * 0.3 // Random aggressiveness 0.6-0.9
      })

      this.enemies.push(enemy)
    })

    // Create virtual joystick for movement (larger and higher up)
    this.joystick = new VirtualJoystick(this, {
      x: 140,
      y: this.cameras.main.height - 200,
      radius: 100,
      base: this.add.circle(0, 0, 100, 0x888888, 0.5),
      thumb: this.add.circle(0, 0, 50, 0xcccccc, 0.8)
    })

    // Create action buttons
    this.createActionButtons()

    // Add controls instructions
    const instructions = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.height - 30,
      'Joystick: Mover | A: Saltar | B: Golpear',
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
      { x: 8, y: 3, z: 8, width: 4, depth: 4, color: 0x8b4513 }, // Brown
      { x: -8, y: 4, z: -8, width: 4, depth: 4, color: 0x2e8b57 }, // Sea green
      { x: 8, y: 5, z: -8, width: 4, depth: 4, color: 0x4169e1 }, // Royal blue
      { x: -8, y: 3, z: 8, width: 4, depth: 4, color: 0x9932cc }, // Dark orchid
      { x: 0, y: 6, z: 0, width: 3, depth: 3, color: 0xff6347 } // Tomato (center high platform)
    ]

    platformConfigs.forEach((config) => {
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
   * Create action buttons for jump and punch in SNES diagonal layout
   */
  private createActionButtons(): void {
    const screenWidth = this.cameras.main.width
    const screenHeight = this.cameras.main.height

    // Diagonal spacing for comfortable thumb reach
    const buttonRadius = 55
    const diagonalOffset = 75

    // Button A (Jump) - Upper right position
    this.jumpButton = new ActionButton({
      scene: this,
      x: screenWidth - 80,
      y: screenHeight - 200,
      radius: buttonRadius,
      label: 'A',
      color: 0x44ff44,
      alpha: 0.6,
      labelColor: '#ffffff',
      labelSize: 34
    })

    this.jumpButton.onPress(() => {
      this.player.jump()
    })

    // Button B (Punch) - Lower left position (diagonal from A)
    this.punchButton = new ActionButton({
      scene: this,
      x: screenWidth - 80 - diagonalOffset,
      y: screenHeight - 200 + diagonalOffset,
      radius: buttonRadius,
      label: 'B',
      color: 0xff4444,
      alpha: 0.6,
      labelColor: '#ffffff',
      labelSize: 34
    })

    this.punchButton.onPress(() => {
      // Punch all enemies
      const allCubes = [...this.enemies]
      this.player.punch(allCubes)
    })
  }

  update(_time: number, delta: number): void {
    // Collect all players (human + AI) for AI targeting
    const allPlayers = [this.player, ...this.enemies]

    // Update player
    this.player.update(delta, allPlayers)

    // Update all enemies (AI will automatically engage)
    this.enemies.forEach((enemy) => {
      enemy.update(delta, allPlayers)
    })

    // Handle joystick movement for human player only
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
