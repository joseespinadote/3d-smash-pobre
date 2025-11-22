import { Scene3D } from '@enable3d/phaser-extension'
import VirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick'

export default class MainScene extends Scene3D {
  private joystick!: InstanceType<typeof VirtualJoystick>
  private controlledCube: any

  constructor() {
    super({ key: 'MainScene' })
  }

  init() {
    this.accessThirdDimension()
  }

  create() {
    // add a phaser text
    const text = this.add.text(this.cameras.main.centerX, 2, 'Controla el cubo rojo con el joystick', {
      fontSize: 24,
      color: 'white'
    })
    text.setOrigin(0.5, 0)

    // adds a controllable red box
    this.controlledCube = this.third.add.box(
      { x: 0, y: 2, z: 0, width: 1, height: 1, depth: 1 },
      { lambert: { color: 0xff0000 } }
    )

    // adds some reference boxes
    this.third.add.box({ x: 3, y: 2, z: 3 }, { lambert: { color: 0x0000ff } })
    this.third.add.box({ x: -3, y: 2, z: -3 }, { lambert: { color: 0x00ff00 } })

    // Create virtual joystick
    this.joystick = new VirtualJoystick(this, {
      x: 150,
      y: this.cameras.main.height - 150,
      radius: 80,
      base: this.add.circle(0, 0, 80, 0x888888, 0.5),
      thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.8)
    })
  }

  update(_time: number, delta: number) {
    const speed = 5 // velocidad de movimiento
    const force = this.joystick.force

    if (force > 0 && this.controlledCube) {
      // Mover el cubo basado en la dirección del joystick
      const moveX = (this.joystick.right ? 1 : this.joystick.left ? -1 : 0) * speed * (delta / 1000)
      const moveZ = (this.joystick.down ? 1 : this.joystick.up ? -1 : 0) * speed * (delta / 1000)

      this.controlledCube.position.x += moveX
      this.controlledCube.position.z += moveZ
    }
  }
}
