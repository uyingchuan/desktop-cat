# State Machine

This directory will contain the pet's behavior state machine.

## Purpose

The state machine manages the pet's autonomous behavior, transitioning between states:

- **Idle**: Default state, pet is stationary
- **Walking**: Pet moves across the screen
- **Sleeping**: Pet takes a nap
- **Playing**: Pet interacts with itself or the user

## Planned States and Transitions

| Current State | Trigger          | Next State |
|---------------|------------------|------------|
| Idle          | Timer elapsed    | Walking    |
| Idle          | Inactivity timer | Sleeping   |
| Walking       | Reached dest     | Idle       |
| Sleeping      | Timer elapsed    | Idle       |
| Any           | User interaction | Playing    |
| Playing       | Timer elapsed    | Idle       |

## Future Directory Contents

- `petMachine.ts`    — FSM definition (states, transitions, guards)
- `machineContext.ts` — React context provider for the machine actor
- `index.ts`         — Public API exports
