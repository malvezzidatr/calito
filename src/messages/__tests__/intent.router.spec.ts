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

  beforeEach(async () => {
    sendText = jest.fn().mockResolvedValue(undefined);
    register = jest.fn().mockResolvedValue(undefined);
    dailyResume = jest.fn().mockResolvedValue(undefined);
    weeklyResume = jest.fn().mockResolvedValue(undefined);
    macroResume = jest.fn().mockResolvedValue(undefined);
    deleteLast = jest.fn().mockResolvedValue(undefined);
    deleteMeal = jest.fn().mockResolvedValue(undefined);
    editLast = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        IntentRouter,
        { provide: WhatsappService, useValue: { sendText } },
        { provide: MealsService, useValue: { register, dailyResume, weeklyResume, macroResume, deleteLast, deleteMeal, editLast } },
      ],
    }).compile();
    router = module.get(IntentRouter);
  });

  it.each<[Intent, string]>([
    ['update_goal',    'atualizar seu objetivo'],
    ['edit_meal',      'editar essa refeição'],
    ['delete_account', 'exclusão da sua conta'],
    ['subscribe',      'link de assinatura'],
    ['help',           'explicar tudo que sei fazer'],
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
