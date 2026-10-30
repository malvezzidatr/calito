import { redactPhone, redactText } from '../log-redactor';

describe('redactPhone', () => {
  it('keeps only the last 4 digits of a plain phone number', () => {
    expect(redactPhone('5511999998888')).toBe('***8888');
  });

  it('strips non-digit characters before masking (JID format)', () => {
    expect(redactPhone('5511999998888@s.whatsapp.net')).toBe('***8888');
  });

  it('fully masks short inputs instead of leaking them', () => {
    expect(redactPhone('123')).toBe('***');
  });
});

describe('redactText', () => {
  it('clips long text and reports the original length', () => {
    const text = 'comi um prato de arroz com feijão e frango';
    expect(redactText(text)).toBe(`[${text.length} chars] comi um prato de arr…`);
  });

  it('leaves short text unclipped but still tagged with length', () => {
    expect(redactText('oi')).toBe('[2 chars] oi');
  });
});
