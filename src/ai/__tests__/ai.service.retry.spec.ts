import { AiService } from '../ai.service';

describe('AiService — rate limit retry', () => {
  let service: AiService;
  let create: jest.Mock;

  const makeCompletion = (content: string) => ({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });

  const rateLimitError = Object.assign(new Error('rate limit'), { status: 429 });

  beforeEach(() => {
    create = jest.fn();
    service = new AiService({ get: () => 'test-key' } as never);
    // injeta client e model diretamente sem chamar onModuleInit
    (service as never as { client: unknown; model: string; defaultTemperature: number }).client = {
      chat: { completions: { create } },
    };
    (service as never as { model: string }).model = 'test-model';
    (service as never as { defaultTemperature: number }).defaultTemperature = 0.2;

    jest
      .spyOn(service as never as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);
  });

  it('returns response directly when no rate limit', async () => {
    create.mockResolvedValue(makeCompletion('pong'));
    const result = await service.chat([{ role: 'user', content: 'ping' }]);
    expect(result).toBe('pong');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    create
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue(makeCompletion('ok'));

    const result = await service.chat([{ role: 'user', content: 'ping' }]);
    expect(result).toBe('ok');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries up to MAX_RETRIES (3) times before throwing', async () => {
    create.mockRejectedValue(rateLimitError);

    await expect(service.chat([{ role: 'user', content: 'ping' }])).rejects.toMatchObject({
      status: 429,
    });
    expect(create).toHaveBeenCalledTimes(4); // 1 tentativa + 3 retries
  });

  it('does not retry on non-429 errors', async () => {
    create.mockRejectedValue(new Error('network error'));

    await expect(service.chat([{ role: 'user', content: 'ping' }])).rejects.toThrow('network error');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('sleep delay doubles exponentially: 2s → 4s → 8s', async () => {
    create.mockRejectedValue(rateLimitError);
    const sleepSpy = jest.spyOn(service as never as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue(undefined);

    await expect(service.chat([{ role: 'user', content: 'ping' }])).rejects.toBeDefined();

    const delays = sleepSpy.mock.calls.map(([ms]) => ms);
    expect(delays).toEqual([2000, 4000, 8000]);
  });
});
