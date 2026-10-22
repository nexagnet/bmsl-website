import { describe, expect, it } from 'vitest';
import { isActivePath } from './NavLinks';

describe('isActivePath', () => {
  it('matches home only on the exact root path', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/du-an', '/')).toBe(false);
  });

  it('marks an area active on its index and on its child routes', () => {
    expect(isActivePath('/du-an', '/du-an')).toBe(true);
    expect(isActivePath('/du-an/toa-nha-a', '/du-an')).toBe(true);
    expect(isActivePath('/kien-thuc/bai-viet/x', '/kien-thuc')).toBe(true);
  });

  it('does not confuse areas that share a prefix', () => {
    expect(isActivePath('/dich-vu-khac', '/dich-vu')).toBe(false);
    expect(isActivePath('/quy-trinh-minh-bach', '/quy-trinh')).toBe(false);
  });
});
