import {
  proto,
  initAuthCreds,
  BufferJSON,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import type { PrismaService } from '../prisma/prisma.service';

export async function createPrismaAuthState(prisma: PrismaService): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  async function readData<T>(type: string, name: string): Promise<T | null> {
    const record = await prisma.whatsappAuth.findUnique({
      where: { type_name: { type, name } },
    });
    if (!record) return null;
    return JSON.parse(JSON.stringify(record.data), BufferJSON.reviver) as T;
  }

  async function writeData(
    type: string,
    name: string,
    value: unknown | null,
  ): Promise<void> {
    if (value === null || value === undefined) {
      await prisma.whatsappAuth
        .delete({ where: { type_name: { type, name } } })
        .catch(() => undefined);
      return;
    }

    const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));

    await prisma.whatsappAuth.upsert({
      where: { type_name: { type, name } },
      create: { type, name, data: serialized },
      update: { data: serialized },
    });
  }

  const creds: AuthenticationCreds =
    (await readData<AuthenticationCreds>('creds', 'creds')) ?? initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const result: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        for (const id of ids) {
          let value = await readData<SignalDataTypeMap[typeof type]>(type, id);
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(
              value as { [k: string]: unknown },
            ) as unknown as SignalDataTypeMap[typeof type];
          }
          if (value) result[id] = value;
        }
        return result;
      },
      set: async (data) => {
        for (const type in data) {
          const category = data[type as keyof SignalDataTypeMap];
          if (!category) continue;
          for (const id in category) {
            const value = category[id];
            await writeData(type, id, value);
          }
        }
      },
    },
  };

  const saveCreds = async () => {
    await writeData('creds', 'creds', creds);
  };

  return { state, saveCreds };
}
