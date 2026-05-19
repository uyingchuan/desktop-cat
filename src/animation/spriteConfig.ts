import idleRight from '../assets/Cat Pixel Animations Pack free vision/idle/idle_sprite.png';
import idleLeft from '../assets/Cat Pixel Animations Pack free vision/idle/idle_left_sprite.png';
import walkRight from '../assets/Cat Pixel Animations Pack free vision/walk/walk_sprite.png';
import walkLeft from '../assets/Cat Pixel Animations Pack free vision/walk/walk_left_sprite.png';
import jumpRight from '../assets/Cat Pixel Animations Pack free vision/jump/jump_sprite.png';
import jumpLeft from '../assets/Cat Pixel Animations Pack free vision/jump/jump_left_sprite.png';

export const FRAME_SIZE = 32;
export const SPRITE_SCALE = 3;

export interface SpriteAnimationConfig {
  frames: number;
  sheetWidth: number;
  duration: number;
}

export const SPRITE_CONFIGS: Record<string, SpriteAnimationConfig> = {
  idle: { frames: 8, sheetWidth: 256, duration: 1600 },
  walking: { frames: 7, sheetWidth: 224, duration: 700 },
  playing: { frames: 4, sheetWidth: 128, duration: 500 },
  sleeping: { frames: 8, sheetWidth: 256, duration: 4000 },
};

export const SPRITE_MAP: Record<string, Record<string, string>> = {
  idle: { right: idleRight, left: idleLeft },
  walking: { right: walkRight, left: walkLeft },
  playing: { right: jumpRight, left: jumpLeft },
  sleeping: { right: idleRight, left: idleLeft },
};

export const ANIMATION_SPRITE_KEY: Record<string, string> = {
  idle: 'idle',
  walking: 'walking',
  sleeping: 'idle',
  playing: 'playing',
};
