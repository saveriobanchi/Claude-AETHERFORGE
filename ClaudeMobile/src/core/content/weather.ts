import { DAY_LENGTH } from './world';

/** Daily weather: deterministic per day and world seed. Day 1 is always clear. */
export type WeatherId = 'clear' | 'breezy' | 'calm' | 'rain' | 'fog' | 'starfall';

export interface WeatherDef {
  id: WeatherId;
  name: string;
  desc: string;
  weight: number;
  wind: number;
  dew: number;
  regrow: number;
  mist: number;
  stardust: number;
}

export const WEATHER: WeatherDef[] = [
  { id: 'clear', name: 'Clear', desc: 'A fair day.', weight: 35, wind: 1, dew: 1, regrow: 1, mist: 1, stardust: 1 },
  { id: 'breezy', name: 'Breezy', desc: 'Windmills spin fast.', weight: 20, wind: 1.25, dew: 1, regrow: 1, mist: 1, stardust: 1 },
  { id: 'calm', name: 'Calm', desc: 'Little wind, but trees grow quickly in the sun.', weight: 12, wind: 0.8, dew: 1, regrow: 1.25, mist: 1, stardust: 1 },
  { id: 'rain', name: 'Rain', desc: 'Dew catchers fill twice as fast and trees regrow quickly.', weight: 18, wind: 0.95, dew: 2, regrow: 1.5, mist: 1, stardust: 1 },
  { id: 'fog', name: 'Fog', desc: 'Thick mist for condensers; the stars hide.', weight: 10, wind: 1, dew: 1, regrow: 1, mist: 2, stardust: 0.75 },
  { id: 'starfall', name: 'Starfall', desc: 'Tonight the sky rains stardust.', weight: 5, wind: 1, dew: 1, regrow: 1, mist: 1, stardust: 2.5 },
];
export const WEATHER_BY_ID: Record<WeatherId, WeatherDef> = Object.fromEntries(WEATHER.map((w) => [w.id, w])) as Record<WeatherId, WeatherDef>;

/** Weather for a day index (0-based) of a world. */
export function weatherFor(day: number, seed: number): WeatherDef {
  if (day <= 0) return WEATHER[0];
  let h = (Math.imul(day + 1, 2654435761) ^ Math.imul(seed | 0, 1597334677)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  const total = WEATHER.reduce((a, w) => a + w.weight, 0);
  let t = (h % 10000) / 10000 * total;
  for (const w of WEATHER) { if (t < w.weight) return w; t -= w.weight; }
  return WEATHER[0];
}

export const dayIndex = (time: number) => Math.floor(time / DAY_LENGTH);
