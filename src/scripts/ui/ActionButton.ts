export interface ActionButtonConfig {
  scene: Phaser.Scene
  x: number
  y: number
  radius?: number
  label?: string
  color?: number
  alpha?: number
  labelColor?: string
  labelSize?: number
}

export default class ActionButton {
  private scene: Phaser.Scene
  private button: Phaser.GameObjects.Container
  private circle: Phaser.GameObjects.Arc
  private text: Phaser.GameObjects.Text
  private isPressed: boolean = false
  private onPressCallback?: () => void

  constructor(config: ActionButtonConfig) {
    this.scene = config.scene
    const radius = config.radius || 50
    const color = config.color || 0x4444ff
    const alpha = config.alpha || 0.6

    // Create container for button
    this.button = this.scene.add.container(config.x, config.y)

    // Create circle background
    this.circle = this.scene.add.circle(0, 0, radius, color, alpha)
    this.circle.setStrokeStyle(3, 0xffffff, 0.8)

    // Create label text
    this.text = this.scene.add.text(0, 0, config.label || 'A', {
      fontSize: (config.labelSize || 32) + 'px',
      color: config.labelColor || '#ffffff',
      fontStyle: 'bold'
    })
    this.text.setOrigin(0.5, 0.5)

    // Add elements to container
    this.button.add([this.circle, this.text])

    // Make interactive
    this.circle.setInteractive()

    // Add pointer events
    this.circle.on('pointerdown', () => {
      this.isPressed = true
      this.circle.setAlpha(1)
      this.circle.setScale(0.9)
      if (this.onPressCallback) {
        this.onPressCallback()
      }
    })

    this.circle.on('pointerup', () => {
      this.isPressed = false
      this.circle.setAlpha(alpha)
      this.circle.setScale(1)
    })

    this.circle.on('pointerout', () => {
      this.isPressed = false
      this.circle.setAlpha(alpha)
      this.circle.setScale(1)
    })
  }

  /**
   * Set callback function when button is pressed
   */
  onPress(callback: () => void): void {
    this.onPressCallback = callback
  }

  /**
   * Check if button is currently pressed
   */
  getIsPressed(): boolean {
    return this.isPressed
  }

  /**
   * Destroy the button
   */
  destroy(): void {
    this.button.destroy()
  }

  /**
   * Set button position
   */
  setPosition(x: number, y: number): void {
    this.button.setPosition(x, y)
  }

  /**
   * Set button visibility
   */
  setVisible(visible: boolean): void {
    this.button.setVisible(visible)
  }
}
