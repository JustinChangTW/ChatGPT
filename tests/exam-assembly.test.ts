import { describe, expect, it } from 'vitest';
import { allocateByWeight } from '@/lib/services/exam-assembly';

describe('allocateByWeight', () => {
  it('should allocate exact total', () => {
    const result = allocateByWeight(60, [11, 7, 23, 9, 11, 10, 16, 13]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(60);
  });
});
