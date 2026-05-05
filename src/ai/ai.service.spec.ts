import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';

const HAS_KEY = !!process.env.GROQ_API_KEY;
const describeMaybe = HAS_KEY ? describe : describe.skip;

describeMaybe('AiService (integration)', () => {
  let service: AiService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [AiService],
    }).compile();
    await module.init();
    service = module.get(AiService);
  });

  it('returns a non-empty response from Groq', async () => {
    const reply = await service.chat([
      { role: 'user', content: 'Responda apenas com a palavra "pong".' },
    ]);
    expect(reply.length).toBeGreaterThan(0);
  }, 15_000);
});
