import { DAY_LENGTH } from './world';

/**
 * Seasons: a deterministic year of four seasons, four days each. They tilt
 * the economy without stopping it — what thrives in summer slows in winter,
 * so a long-lived island plans around the calendar.
 */
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonDef {
  id: SeasonId;
  name: string;
  desc: string;
  /** Field growth. */
  crop: number;
  /** Tree and fruit regrowth. */
  regrow: number;
  wind: number;
  dew: number;
  hive: number;
  /** Settlers eat this much more often. */
  appetite: number;
}

export const SEASON_DAYS = 4;
export const SEASONS: SeasonDef[] = [
  { id: 'spring', name: 'Spring', desc: 'Trees regrow quickly; dew is plentiful.', crop: 1.1, regrow: 1.25, wind: 1, dew: 1.1, hive: 1.1, appetite: 1 },
  { id: 'summer', name: 'Summer', desc: 'Fields and bees at their best; the air is dry and still.', crop: 1.25, regrow: 1, wind: 0.9, dew: 0.8, hive: 1.25, appetite: 1 },
  { id: 'autumn', name: 'Autumn', desc: 'Strong winds and a last flush of fruit.', crop: 1, regrow: 1.1, wind: 1.15, dew: 1, hive: 0.9, appetite: 1 },
  { id: 'winter', name: 'Winter', desc: 'Fields and trees slow, bees sleep; windmills roar and settlers eat more.', crop: 0.6, regrow: 0.7, wind: 1.25, dew: 1, hive: 0.5, appetite: 1.25 },
];

export const seasonFor = (time: number): SeasonDef => SEASONS[Math.floor(time / DAY_LENGTH / SEASON_DAYS) % SEASONS.length];
/** 1-based year of the world. */
export const yearFor = (time: number): number => Math.floor(time / DAY_LENGTH / SEASON_DAYS / SEASONS.length) + 1;
/** Fraction of the current season elapsed (0..1). */
export const seasonProgress = (time: number): number => ((time / DAY_LENGTH) % SEASON_DAYS) / SEASON_DAYS;
