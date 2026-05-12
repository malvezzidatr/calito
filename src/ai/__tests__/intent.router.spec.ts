jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

jest.mock('../../meals/meals.service', () => ({
  MealsService: class {},
}));

import { Test } from '@nestjs/testing';
import { IntentRouter } from '../intent.router';
import { Intent } from '../intents';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { MealsService } from '../../meals/meals.service';

describe('IntentRouter', () => {
  let router: IntentRouter;
  let sendText: jest.Mock;
  let register: jest.Mock;

  beforeEach(async () => {
    sendText = jest.fn().mockResolvedValue(undefined);
    register = jest.fn().mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        IntentRouter,
        { provide: WhatsappService, useValue: { sendText } },
        { provide: MealsService, useValue: { register } },
      ],
    }).compile();
    router = module.get(IntentRouter);
  });

  it.each<[Intent, string]>([
    ['query_daily',    'resumo do dia'],
    ['query_period',   'resumo da semana'],
    ['query_macro',    'esse macro'],
    ['update_goal',    'atualizar seu objetivo'],
    ['edit_meal',      'editar essa refeição'],
    ['delete_meal',    'apagar essa refeição'],
    ['edit_last',      'corrigir seu último registro'],
    ['delete_last',    'apagar seu último registro'],
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
