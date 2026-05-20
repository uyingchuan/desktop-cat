import idleRight from '../assets/cat-pixel-animations/idle/idle_sprite.png';
import idleLeft from '../assets/cat-pixel-animations/idle/idle_left_sprite.png';
import idle2Right from '../assets/cat-pixel-animations/idle2/idle2_sprite.png';
import idle2Left from '../assets/cat-pixel-animations/idle2/idle2_left_sprite.png';
import walkRight from '../assets/cat-pixel-animations/walk/walk_sprite.png';
import walkLeft from '../assets/cat-pixel-animations/walk/walk_left_sprite.png';
import runRight from '../assets/cat-pixel-animations/run/run_sprite.png';
import runLeft from '../assets/cat-pixel-animations/run/run_left_sprite.png';
import jumpRight from '../assets/cat-pixel-animations/jump/jump_sprite.png';
import jumpLeft from '../assets/cat-pixel-animations/jump/jump_left_sprite.png';
import floatRight from '../assets/cat-pixel-animations/float/float_sprite.png';
import floatLeft from '../assets/cat-pixel-animations/float/float_left_sprite.png';
import sleepRight from '../assets/cat-pixel-animations/sleep/sleep_sprite.png';
import sleepLeft from '../assets/cat-pixel-animations/sleep/sleep_left_sprite.png';
import lickRight from '../assets/cat-pixel-animations/lick/lick_sprite.png';
import lickLeft from '../assets/cat-pixel-animations/lick/lick_left_sprite.png';
import attackRight from '../assets/cat-pixel-animations/attack/attack_sprite.png';
import attackLeft from '../assets/cat-pixel-animations/attack/attack_left_sprite.png';
import hurtRight from '../assets/cat-pixel-animations/hurt/hurt_sprite.png';
import hurtLeft from '../assets/cat-pixel-animations/hurt/hurt_left_sprite.png';
import deadRight from '../assets/cat-pixel-animations/dead/dead_sprite.png';
import deadLeft from '../assets/cat-pixel-animations/dead/dead_left_sprite.png';

export const FRAME_SIZE = 32;
export const SPRITE_SCALE = 3;

export interface SpriteAnimationConfig {
  frames: number;
  sheetWidth: number;
  duration: number;
}

export const SPRITE_CONFIGS: Record<string, SpriteAnimationConfig> = {
  idle:     { frames: 8,  sheetWidth: 256, duration: 1600 },
  idle2:    { frames: 7,  sheetWidth: 224, duration: 1400 },
  walking:  { frames: 7,  sheetWidth: 224, duration: 700 },
  running:  { frames: 6,  sheetWidth: 192, duration: 400 },
  sleeping: { frames: 9,  sheetWidth: 288, duration: 3600 },
  playing:  { frames: 4,  sheetWidth: 128, duration: 500 },
  floating: { frames: 10, sheetWidth: 320, duration: 1200 },
  licking:  { frames: 13, sheetWidth: 416, duration: 2000 },
  attacking:{ frames: 6,  sheetWidth: 192, duration: 500 },
  hurt:     { frames: 4,  sheetWidth: 128, duration: 600 },
  dead:     { frames: 12, sheetWidth: 384, duration: 2000 },
};

export const SPRITE_MAP: Record<string, Record<string, string>> = {
  idle:     { right: idleRight,   left: idleLeft },
  idle2:    { right: idle2Right,  left: idle2Left },
  walking:  { right: walkRight,   left: walkLeft },
  running:  { right: runRight,    left: runLeft },
  sleeping: { right: sleepRight,  left: sleepLeft },
  playing:  { right: jumpRight,   left: jumpLeft },
  floating: { right: floatRight,  left: floatLeft },
  licking:  { right: lickRight,   left: lickLeft },
  attacking:{ right: attackRight, left: attackLeft },
  hurt:     { right: hurtRight,   left: hurtLeft },
  dead:     { right: deadRight,   left: deadLeft },
};
