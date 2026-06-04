import { pickRandom } from '../pick-random';

describe('pickRandom', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the first element when Math.random is 0', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickRandom(['a', 'b', 'c'])).toBe('a');
  });

  it('returns the last element when Math.random returns close to 1', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(pickRandom(['a', 'b', 'c'])).toBe('c');
  });

  it('returns the middle element for a mid-range Math.random', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(pickRandom(['a', 'b', 'c'])).toBe('b');
  });

  it('works with a single-element array', () => {
    expect(pickRandom(['only'])).toBe('only');
  });
});
