import type { InputSnapshot } from '../types/input'
import { InputSystem } from './inputSystem'
import { PetStateMachine } from './petStateMachine'
import { getSpriteKey } from './animationMapper'
import { KeyZoneDetector } from './keyZoneDetector'
import { runtimeStore } from '../stores/runtimeStore'

type ChangeCallback = () => void

export class PetEngine {
  private inputSystem = new InputSystem()
  private stateMachine = new PetStateMachine()
  private zoneDetector = new KeyZoneDetector()
  private changeListeners = new Set<ChangeCallback>()

  constructor() {
    // Pipeline 1: StateMachine
    this.inputSystem.onEvent((e) => {
      this.stateMachine.send(e)
    })

    this.stateMachine.onStateChange((_prev, next) => {
      runtimeStore.setState({
        currentState: next,
        currentSprite: getSpriteKey(next),
      })
      this.notifyChange()
    })

    // Pipeline 2: KeyZoneDetector
    this.inputSystem.onEvent((e) => {
      this.zoneDetector.handleEvent(e)
    })

    this.zoneDetector.onChange((zone) => {
      runtimeStore.setState({ activeZone: zone })
      this.notifyChange()
    })
  }

  /** Feed an input snapshot into the engine (called by inputRuntime) */
  process(snapshot: InputSnapshot): void {
    runtimeStore.setState({ mousePos: snapshot.mouse })
    this.inputSystem.process(snapshot)
  }

  start(): void {
    // Engine is ready — inputRuntime feeds events via process()
  }

  stop(): void {
    this.changeListeners.clear()
    runtimeStore.setState({
      currentState: 'idle',
      currentSprite: 'idle',
      activeZone: 0,
      mousePos: { x: 0, y: 0 },
    })
  }

  onChange(fn: ChangeCallback): () => void {
    this.changeListeners.add(fn)
    return () => { this.changeListeners.delete(fn) }
  }

  private notifyChange(): void {
    for (const fn of this.changeListeners) fn()
  }
}
