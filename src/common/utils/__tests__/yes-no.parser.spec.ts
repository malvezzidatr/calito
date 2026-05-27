import { parseYesNo } from '../yes-no.parser';

describe('parseYesNo', () => {
  it.each(['sim', 's', 'yes', 'y', 'SIM', '  sim  ', 'Yes'])('returns "yes" for %p', (input) => {
    expect(parseYesNo(input)).toBe('yes');
  });

  it.each(['não', 'nao', 'n', 'no', 'NÃO', '  nao  ', 'No'])('returns "no" for %p', (input) => {
    expect(parseYesNo(input)).toBe('no');
  });

  it.each(['talvez', '', '   ', 'simbora', 'naoexiste', 'okay'])('returns null for %p', (input) => {
    expect(parseYesNo(input)).toBeNull();
  });
});
