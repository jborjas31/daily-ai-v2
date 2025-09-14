import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import useNowTick from '@/lib/utils/useNowTick';

function View({ period = 1000 }: { period?: number }) {
  const { nowISO, nowTime } = useNowTick(period);
  return <div data-testid="val">{nowISO}-{nowTime}</div>;
}

describe('useNowTick', () => {
  it('returns current local date/time strings', () => {
    const { getByTestId, unmount } = render(<View period={10} />);
    const val = getByTestId('val').textContent || '';
    expect(/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}$/.test(val)).toBe(true);
    unmount();
  });
});
