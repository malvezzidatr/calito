import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiService } from '../ai.service';
import { IntentClassifier } from '../intent.classifier';

const HAS_KEY = !!process.env.GROQ_API_KEY;
const describeMaybe = HAS_KEY ? describe : describe.skip;

describeMaybe('IntentClassifier (integration)', () => {
  let classifier: IntentClassifier;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [AiService, IntentClassifier],
    }).compile();
    await module.init();
    classifier = module.get(IntentClassifier);
  });

  it.each([
    ['comi 2 ovos e uma banana', 'register_meal'],
    ['quanto comi hoje?', 'query_daily'],
    ['como foi minha semana?', 'query_period'],
    ['quanta proteína comi hoje?', 'query_macro'],
    ['meu perfil', 'view_profile'],
    ['agora quero ganhar massa', 'update_goal'],
    ['era 1 ovo, não 2', 'edit_last'],
    ['apaga o último', 'delete_last'],
    ['apagar minha conta', 'delete_account'],
    ['quero assinar', 'subscribe'],
    ['o que você faz?', 'help'],
    ['oi', 'greeting'],
    ['qual é a previsão do tempo?', 'unknown'],
  ])('classifies "%s" as %s', async (text, expected) => {
    const intent = await classifier.classify(text);
    expect(intent).toBe(expected);
  }, 15_000);
});
