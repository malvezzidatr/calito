jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

jest.mock('../../meals/meals.service', () => ({
  MealsService: class {},
}));

import { Test } from '@nestjs/testing';
import { IntentRouter } from '../intent.router';
import { Intent } from '../../ai/intents';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { MealsService } from '../../meals/meals.service';

describe('IntentRouter', () => {
  let router: IntentRouter;
  let sendText: jest.Mock;
  let register: jest.Mock;
  let dailyResume: jest.Mock;
  let weeklyResume: jest.Mock;
  let macroResume: jest.Mock;
  let deleteLast: jest.Mock;
  let deleteMeal: jest.Mock;
  let editLast: jest.Mock;
  let editMeal: jest.Mock;

  beforeEach(async () => {
    sendText = jest.fn().mockResolvedValue(undefined);
    register = jest.fn().mockResolvedValue(undefined);
    dailyResume = jest.fn().mockResolvedValue(undefined);
    weeklyResume = jest.fn().mockResolvedValue(undefined);
    macroResume = jest.fn().mockResolvedValue(undefined);
    deleteLast = jest.fn().mockResolvedValue(undefined);
    deleteMeal = jest.fn().mockResolvedValue(undefined);
    editLast = jest.fn().mockResolvedValue(undefined);
    editMeal = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        IntentRouter,
        { provide: WhatsappService, useValue: { sendText } },
        { provide: MealsService, useValue: { register, dailyResume, weeklyResume, macroResume, deleteLast, deleteMeal, editLast, editMeal } },
      ],
    }).compile();
    router = module.get(IntentRouter);
  });

  it.each<[Intent, string]>([
    ['update_goal',    'atualizar seu objetivo'],
    ['delete_account', 'exclusão da sua conta'],
    ['subscribe',      'link de assinatura'],
    ['greeting',       'Bora registrar o que comeu'],
    ['unknown',        'Não entendi'],
  ])('routes %s to its handler', async (intent, snippet) => {
    await router.route(intent, '5511999', 'qualquer', '5511999@s.whatsapp.net');
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith(
      '5511999@s.whatsapp.net',
      expect.stringContaining(snippet),
    );
  });

  describe('help handler', () => {
    it('lists registering, querying, listing and editing capabilities with concrete examples', async () => {
      await router.route('help', '5511999', 'o que você faz?', '5511999@s.whatsapp.net');

      expect(sendText).toHaveBeenCalledTimes(1);
      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('Registrar refeições');
      expect(message).toContain('Consultar o dia');
      expect(message).toContain('Listar refeições');
      expect(message).toContain('Editar ou apagar');
      expect(message).toContain('"comi 2 ovos e 1 banana"');
      expect(message).toContain('"como foi meu dia?"');
      expect(message).toContain('"corrige meu almoço pra carne com salada"');
    });

    it('does NOT promise features that are still stubs (assinatura, update_goal, delete_account)', async () => {
      await router.route('help', '5511999', 'ajuda', '5511999@s.whatsapp.net');

      const [, message] = sendText.mock.calls[0];
      expect(message).not.toMatch(/assinatura|assinar|pagamento/i);
      expect(message).not.toMatch(/mudar.*objetivo|atualizar.*objetivo/i);
      expect(message).not.toMatch(/apagar minha conta|deletar conta/i);
    });
  });

  it('routes register_meal to MealsService.register', async () => {
    await router.route('register_meal', '5511999', 'comi 2 ovos', '5511999@s.whatsapp.net');

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      '5511999',
      'comi 2 ovos',
      '5511999@s.whatsapp.net',
    );
    expect(sendText).not.toHaveBeenCalled();
  });

  it('routes query_daily to MealsService.dailyResume', async () => {
    await router.route('query_daily', '5511999', 'como foi meu dia?', '5511999@s.whatsapp.net');

    expect(dailyResume).toHaveBeenCalledTimes(1);
    expect(dailyResume).toHaveBeenCalledWith('5511999', '5511999@s.whatsapp.net');
    expect(sendText).not.toHaveBeenCalled();
  });

  it('routes query_period to MealsService.weeklyResume', async () => {
    await router.route('query_period', '5511999', 'como foi minha semana?', '5511999@s.whatsapp.net');

    expect(weeklyResume).toHaveBeenCalledTimes(1);
    expect(weeklyResume).toHaveBeenCalledWith('5511999', '5511999@s.whatsapp.net');
    expect(sendText).not.toHaveBeenCalled();
  });

  it('routes query_macro to MealsService.macroResume forwarding the text', async () => {
    await router.route('query_macro', '5511999', 'quanta proteína comi hoje?', '5511999@s.whatsapp.net');

    expect(macroResume).toHaveBeenCalledTimes(1);
    expect(macroResume).toHaveBeenCalledWith('5511999', 'quanta proteína comi hoje?', '5511999@s.whatsapp.net');
    expect(sendText).not.toHaveBeenCalled();
  });

  it('routes delete_meal to MealsService.deleteMeal forwarding the text', async () => {
    await router.route('delete_meal', '5511999', 'apaga o lanche das 16h', '5511999@s.whatsapp.net');

    expect(deleteMeal).toHaveBeenCalledTimes(1);
    expect(deleteMeal).toHaveBeenCalledWith('5511999', 'apaga o lanche das 16h', '5511999@s.whatsapp.net');
    expect(sendText).not.toHaveBeenCalled();
  });

  it('routes delete_last to MealsService.deleteLast', async () => {
    await router.route('delete_last', '5511999', 'apaga o último', '5511999@s.whatsapp.net');

    expect(deleteLast).toHaveBeenCalledTimes(1);
    expect(deleteLast).toHaveBeenCalledWith('5511999', '5511999@s.whatsapp.net');
    expect(sendText).not.toHaveBeenCalled();
  });

  it('routes edit_last to MealsService.editLast forwarding the text', async () => {
    await router.route('edit_last', '5511999', 'era 1 ovo, não 2', '5511999@s.whatsapp.net');

    expect(editLast).toHaveBeenCalledTimes(1);
    expect(editLast).toHaveBeenCalledWith('5511999', 'era 1 ovo, não 2', '5511999@s.whatsapp.net');
    expect(sendText).not.toHaveBeenCalled();
  });

  it('routes edit_meal to MealsService.editMeal forwarding the text', async () => {
    await router.route('edit_meal', '5511999', 'corrige meu almoço pra carne com salada', '5511999@s.whatsapp.net');

    expect(editMeal).toHaveBeenCalledTimes(1);
    expect(editMeal).toHaveBeenCalledWith('5511999', 'corrige meu almoço pra carne com salada', '5511999@s.whatsapp.net');
    expect(sendText).not.toHaveBeenCalled();
  });

  describe('unknown handler', () => {
    it('returns a friendly message that lists the main capabilities', async () => {
      await router.route('unknown', '5511999', 'oi tudo bem?', '5511999@s.whatsapp.net');

      const [, message] = sendText.mock.calls[0];
      expect(message).toMatch(/registrar/i);
      expect(message).toMatch(/consultar/i);
      expect(message).toMatch(/objetivo/i);
      expect(message).toMatch(/editar|apagar/i);
    });

    it('includes a concrete example for each capability', async () => {
      await router.route('unknown', '5511999', 'foo', '5511999@s.whatsapp.net');

      const [, message] = sendText.mock.calls[0];
      expect(message).toContain('"');
    });
  });
});
