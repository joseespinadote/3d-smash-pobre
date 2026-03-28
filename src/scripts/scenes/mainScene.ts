import { Scene3D, THREE } from '@enable3d/phaser-extension'
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
  private isDesktop: boolean = false
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private jumpKey!: Phaser.Input.Keyboard.Key
  private punchKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super({ key: 'MainScene' })
  }

  init() {
    this.accessThirdDimension()
    this.isDesktop = this.sys.game.device.os.desktop
  }

  create() {
    // Set sky blue background
    this.third.scene.background = new THREE.Color(0x87ceeb)

    // Setup light and ground
    this.third.warpSpeed('-ground', 'light') // -ground to not create default floor

    // Set gravity stronger for snappier jumps (default is -9.8)
    this.third.physics.setGravity(0, -20, 0)

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
      jumpForce: 12, // Adjusted for stronger gravity
      doubleJumpForce: 8,
      punchForce: 12,
      punchRange: 3
    })

    // Create enemy cubes with different colors and AI
    const enemyColors = [
      { color: 0x0000ff, x: 8, z: 8 }, // Blue
      { color: 0x00ff00, x: -8, z: -8 }, // Green
      { color: 0xffff00, x: 8, z: -8 }, // Yellow
      { color: 0xff00ff, x: -8, z: 8 } // Magenta
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

    // Setup input
    if (this.isDesktop) {
      this.setupKeyboard()
    } else {
      this.setupMobileUI()
    }

    // Add controls instructions
    const instructionText = this.isDesktop
      ? 'Flechas: Mover | Z: Saltar | X: Golpear'
      : 'Joystick: Mover | A: Saltar | B: Golpear'

    const instructions = this.add.text(this.cameras.main.centerX, this.cameras.main.height - 30, instructionText, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    })
    instructions.setOrigin(0.5, 1)
  }

  private setupKeyboard(): void {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.jumpKey = this.input.keyboard.addKey('Z')
      this.punchKey = this.input.keyboard.addKey('X')

      this.jumpKey.on('down', () => this.player.jump())
      this.punchKey.on('down', () => this.player.punch(this.enemies))
    }
  }

  private setupMobileUI(): void {
    // Create virtual joystick for movement
    this.joystick = new VirtualJoystick(this, {
      x: 140,
      y: this.cameras.main.height - 200,
      radius: 100,
      base: this.add.circle(0, 0, 100, 0x888888, 0.5),
      thumb: this.add.circle(0, 0, 50, 0xcccccc, 0.8)
    })

    this.createActionButtons()
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
      color: 0x228b22 // Grass green
    })
    this.platforms.push(basePlatform)

    // The "Spawn" platform (reddish center high platform) - Keep it static as requested
    const spawnPlatform = new Platform({
      scene: this,
      x: 0,
      y: 6,
      z: 0,
      width: 3,
      height: 1,
      depth: 3,
      color: 0xff6347 // Tomato
    })
    this.platforms.push(spawnPlatform)

    // Additional platforms: smaller, randomized, and moving
    const colors = [0x8b4513, 0x2e8b57, 0x4169e1, 0x9932cc, 0xffd700, 0xff8c00]

    for (let i = 0; i < 6; i++) {
      const x = (Math.random() - 0.5) * 25 // Random X between -12.5 and 12.5
      const z = (Math.random() - 0.5) * 25 // Random Z
      const y = 2 + Math.random() * 6 // Random Y height

      const isMoving = Math.random() > 0.3
      const moveAxis = ['x', 'z'][Math.floor(Math.random() * 2)] as 'x' | 'z'

      const platform = new Platform({
        scene: this,
        x: x,
        y: y,
        z: z,
        width: 2 + Math.random() * 2, // Smaller: 2-4 width
        height: 1,
        depth: 2 + Math.random() * 2, // Smaller: 2-4 depth
        color: colors[i % colors.length],
        moveDistance: isMoving ? 2 + Math.random() * 3 : 0,
        moveSpeed: isMoving ? 0.5 + Math.random() * 1.5 : 0,
        moveAxis: moveAxis
      })
      this.platforms.push(platform)
    }
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
      this.player.punch(this.enemies)
    })
  }

  update(_time: number, delta: number): void {
    // Update platforms
    this.platforms.forEach((p) => p.update(delta))

    // Collect all players (human + AI) for AI targeting
    const allPlayers = [this.player, ...this.enemies]

    // Update player
    this.player.update(delta, allPlayers)

    // Update all enemies (AI will automatically engage)
    this.enemies.forEach((enemy) => {
      enemy.update(delta, allPlayers)
    })

    if (this.isDesktop) {
      this.handleKeyboardMovement()
    } else {
      this.handleJoystickMovement()
    }
  }

  private handleKeyboardMovement(): void {
    let moveX = 0
    let moveZ = 0
    const speed = 5

    if (this.cursors.left.isDown) moveX = -1
    else if (this.cursors.right.isDown) moveX = 1

    if (this.cursors.up.isDown) moveZ = -1
    else if (this.cursors.down.isDown) moveZ = 1

    this.player.move(moveX, moveZ, speed)
  }

  private handleJoystickMovement(): void {
    const force = this.joystick.force
    if (force > 0) {
      const moveX = this.joystick.right ? 1 : this.joystick.left ? -1 : 0
      const moveZ = this.joystick.down ? 1 : this.joystick.up ? -1 : 0
      this.player.move(moveX, moveZ, 5)
    } else {
      this.player.move(0, 0, 0)
    }
  }
}
