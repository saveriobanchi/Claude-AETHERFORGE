import { describe, expect, it } from 'vitest';
import { canScroll } from '../../src/input/scrollguard';

const box = (o: Partial<HTMLElement>) => ({ scrollLeft: 0, scrollTop: 0, scrollWidth: 100, clientWidth: 100, scrollHeight: 100, clientHeight: 100, ...o }) as HTMLElement;

describe('scroll guard', () => {
  it('lets a list move only while it has room that way', () => {
    const row = box({ scrollWidth: 500, clientWidth: 200 });
    expect(canScroll(row, 'x', -10)).toBe(true); // finger left: content moves on
    expect(canScroll(row, 'x', 10)).toBe(false); // already at the start
    row.scrollLeft = 300;
    expect(canScroll(row, 'x', -10)).toBe(false); // at the end: no sliding past it
    expect(canScroll(row, 'x', 10)).toBe(true);
    const col = box({ scrollHeight: 400, clientHeight: 100, scrollTop: 150 });
    expect(canScroll(col, 'y', -5)).toBe(true);
    expect(canScroll(col, 'y', 5)).toBe(true);
  });
});
