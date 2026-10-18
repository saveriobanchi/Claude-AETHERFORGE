import { rebuildCache } from '../../src/core/sim';
import { capacity, type GameState } from '../../src/core/state';
export function rebuildCacheFor(s: GameState): void { s.topoDirty = true; rebuildCache(s); }
export { capacity };
