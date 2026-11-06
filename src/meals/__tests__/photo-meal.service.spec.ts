jest.mock('../../whatsapp/whatsapp.service', () => ({ WhatsappService: class {} }));
import { PhotoMealService } from '../photo-meal.service';

describe('PhotoMealService', () => {
  const user = { id: 'u1' } as any;
  const items = [{ food: 'arroz', quantity: 100, unit: 'g' }];
  let ai: any;
  let foods: any;
  let prisma: any;
  let whatsapp: any;
  let service: PhotoMealService;
  const draft = () => ({ id: 'd1', user_id: 'u1', foods: items, meal_type: null, message_id: 'm1', expires_at: new Date(Date.now() + 60000) });

  beforeEach(() => {
    ai = { analyzeImage: jest.fn().mockResolvedValue(JSON.stringify({ foods: items, meal_type: null })), chat: jest.fn() };
    foods = { calculateWithFallback: jest.fn().mockResolvedValue({ matched: [{}], estimated: [], failed: [], totals: { calories: 100, protein: 2, carbs: 20, fat: 1 } }) };
    prisma = {
      photoMealDraft: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn(), deleteMany: jest.fn(), updateMany: jest.fn() },
      meal: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    whatsapp = { downloadImage: jest.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0x00])), sendText: jest.fn().mockResolvedValue(undefined) };
    service = new PhotoMealService(ai, foods, prisma, whatsapp);
  });

  it('analyzes photo and caption once and stores structured draft', async () => {
    await service.receive(user, 'jid', { key: { id: 'm1' } } as any, { mimetype: 'image/jpeg' }, 'meu almoço');
    expect(ai.analyzeImage).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', 'meu almoço', expect.any(String));
    expect(prisma.photoMealDraft.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ foods: items, message_id: 'm1' }) }));
    expect(foods.calculateWithFallback).not.toHaveBeenCalled();
  });

  it('rejects unsupported images without calling AI', async () => {
    await service.receive(user, 'jid', { key: { id: 'm1' } } as any, { mimetype: 'image/gif' }, '');
    expect(whatsapp.downloadImage).not.toHaveBeenCalled();
    expect(ai.analyzeImage).not.toHaveBeenCalled();
  });

  it('confirms using existing calculator and atomically claims the draft', async () => {
    prisma.photoMealDraft.findUnique.mockResolvedValue(draft());
    const tx = { photoMealDraft: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) }, meal: { create: jest.fn() } };
    prisma.$transaction.mockImplementation(fn => fn(tx));
    await service.handlePending(user, 'jid', 'sim');
    expect(foods.calculateWithFallback).toHaveBeenCalledWith(items);
    expect(ai.chat).not.toHaveBeenCalled();
    expect(tx.meal.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ photo_message_id: 'm1', calories: 100 }) }));
  });

  it('does not save partial calculations', async () => {
    prisma.photoMealDraft.findUnique.mockResolvedValue(draft());
    foods.calculateWithFallback.mockResolvedValue({ matched: [{}], estimated: [], failed: [{ input: { food: 'feijão' } }], totals: {} });
    await service.handlePending(user, 'jid', 'sim');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(whatsapp.sendText).toHaveBeenCalledWith('jid', expect.stringContaining('feijão'));
  });

  it('cancels without invoking AI or calculation', async () => {
    prisma.photoMealDraft.findUnique.mockResolvedValue(draft());
    await service.handlePending(user, 'jid', 'cancelar');
    expect(prisma.photoMealDraft.deleteMany).toHaveBeenCalled();
    expect(ai.chat).not.toHaveBeenCalled();
    expect(foods.calculateWithFallback).not.toHaveBeenCalled();
  });

  it('does not analyze a photo already registered', async () => {
    prisma.meal.findUnique.mockResolvedValue({ id: 'meal1' });
    await service.receive(user, 'jid', { key: { id: 'm1' } } as any, { mimetype: 'image/jpeg' }, '');
    expect(ai.analyzeImage).not.toHaveBeenCalled();
  });

  it('asks for another photo when vision returns a clarification', async () => {
    ai.analyzeImage.mockResolvedValue(JSON.stringify({ needs_clarification: 'Envie uma foto mais clara.' }));
    await service.receive(user, 'jid', { key: { id: 'm1' } } as any, { mimetype: 'image/jpeg' }, '');
    expect(prisma.photoMealDraft.upsert).not.toHaveBeenCalled();
    expect(whatsapp.sendText).toHaveBeenCalledWith('jid', 'Envie uma foto mais clara.');
  });

  it('keeps the draft and reports an invalid AI response', async () => {
    ai.analyzeImage.mockResolvedValue('invalid json');
    await service.receive(user, 'jid', { key: { id: 'm1' } } as any, { mimetype: 'image/jpeg' }, '');
    expect(prisma.photoMealDraft.upsert).not.toHaveBeenCalled();
    expect(whatsapp.sendText).toHaveBeenCalledWith('jid', expect.stringContaining('Não consegui analisar'));
  });

  it('applies a correction and asks for confirmation again', async () => {
    prisma.photoMealDraft.findUnique.mockResolvedValue(draft());
    ai.chat.mockResolvedValue(JSON.stringify({ foods: [{ food: 'arroz', quantity: 200, unit: 'g' }], meal_type: null }));
    await service.handlePending(user, 'jid', 'eram 200g de arroz');
    expect(prisma.photoMealDraft.updateMany).toHaveBeenCalled();
    expect(whatsapp.sendText).toHaveBeenCalledWith('jid', expect.stringContaining('200 g'));
    expect(foods.calculateWithFallback).not.toHaveBeenCalled();
  });

  it('removes an expired draft without calculating', async () => {
    prisma.photoMealDraft.findUnique.mockResolvedValue({ ...draft(), expires_at: new Date(0) });
    await service.handlePending(user, 'jid', 'sim');
    expect(prisma.photoMealDraft.deleteMany).toHaveBeenCalled();
    expect(foods.calculateWithFallback).not.toHaveBeenCalled();
  });

  it('does not create a meal when another confirmation already claimed the draft', async () => {
    prisma.photoMealDraft.findUnique.mockResolvedValue(draft());
    const tx = { photoMealDraft: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) }, meal: { create: jest.fn() } };
    prisma.$transaction.mockImplementation(fn => fn(tx));
    await service.handlePending(user, 'jid', 'sim');
    expect(tx.meal.create).not.toHaveBeenCalled();
  });
});
