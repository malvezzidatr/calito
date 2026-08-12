import { User } from '@prisma/client';
import { RetentionService } from '../retention.service';

describe('RetentionService', () => {
  let service: RetentionService;
  let findCancelledInactiveBefore: jest.Mock;
  let findStaleUnconsentedBefore: jest.Mock;
  let deleteByPhone: jest.Mock;
  let deleteOlderThanParsed: jest.Mock;
  let deleteOlderThanEstimated: jest.Mock;

  const makeUser = (id: string, phone: string): User => ({ id, phone } as unknown as User);

  beforeEach(() => {
    findCancelledInactiveBefore = jest.fn().mockResolvedValue([]);
    findStaleUnconsentedBefore = jest.fn().mockResolvedValue([]);
    deleteByPhone = jest.fn().mockResolvedValue(undefined);
    deleteOlderThanParsed = jest.fn().mockResolvedValue(0);
    deleteOlderThanEstimated = jest.fn().mockResolvedValue(0);

    service = new RetentionService(
      { findCancelledInactiveBefore, findStaleUnconsentedBefore, deleteByPhone } as never,
      { deleteOlderThan: deleteOlderThanParsed } as never,
      { deleteOlderThan: deleteOlderThanEstimated } as never,
    );
  });

  it('purges cancelled accounts inactive beyond the retention window', async () => {
    findCancelledInactiveBefore.mockResolvedValueOnce([makeUser('user-1', '5511111')]);

    await service.purge();

    expect(deleteByPhone).toHaveBeenCalledWith('5511111');
  });

  it('purges accounts stuck before consent beyond the retention window', async () => {
    findStaleUnconsentedBefore.mockResolvedValueOnce([makeUser('user-2', '5522222')]);

    await service.purge();

    expect(deleteByPhone).toHaveBeenCalledWith('5522222');
  });

  it('purges both cache tables by age', async () => {
    await service.purge();

    expect(deleteOlderThanParsed).toHaveBeenCalledTimes(1);
    expect(deleteOlderThanEstimated).toHaveBeenCalledTimes(1);
  });

  it('skips a failing deletion and keeps purging the rest', async () => {
    findCancelledInactiveBefore.mockResolvedValueOnce([makeUser('user-1', '5511111'), makeUser('user-2', '5522222')]);
    deleteByPhone.mockRejectedValueOnce(new Error('db down'));

    await service.purge();

    expect(deleteByPhone).toHaveBeenCalledTimes(2);
  });

  it('does nothing destructive when nothing is stale', async () => {
    await service.purge();
    expect(deleteByPhone).not.toHaveBeenCalled();
  });
});
