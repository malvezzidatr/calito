import {
  proto,
  initAuthCreds,
  BufferJSON,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import type { PrismaService } from '../prisma/prisma.service';
import { decryptJson, encryptJson, isEncryptedPayload, loadAuthEncryptionKey } from './utils/auth-crypto';

export async function createPrismaAuthState(prisma: PrismaService): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  // Chave carregada uma vez (lazy: só quando o bot de fato inicializa a sessão),
  // igual ao padrão de outros segredos lazy do projeto (MP_ACCESS_TOKEN etc.).
  const encryptionKey = loadAuthEncryptionKey(process.env.WHATSAPP_AUTH_ENCRYPTION_KEY);

  async function readData<T>(type: string, name: string): Promise<T | null> {
    const record = await prisma.whatsappAuth.findUnique({
      where: { type_name: { type, name } },
    });
    if (!record) return null;

    // Registros gravados antes da criptografia (CS-123) continuam legíveis;
    // o próximo writeData já os regrava cifrados.
    const plain = isEncryptedPayload(record.data)
      ? decryptJson<unknown>(record.data, encryptionKey)
      : record.data;

    return JSON.parse(JSON.stringify(plain), BufferJSON.reviver) as T;
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
    const encrypted = encryptJson(serialized, encryptionKey);

    await prisma.whatsappAuth.upsert({
      where: { type_name: { type, name } },
      create: { type, name, data: encrypted },
      update: { data: encrypted },
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
