import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL não configurada');
    }

    // pg v8+ interprets sslmode=require as certificate verification by default.
    // Supabase's shared pooler supports encrypted connections with require, but
    // its certificate chain may not be trusted by the Node runtime. Keep this
    // compatibility option scoped to the runtime adapter; Prisma CLI migrations
    // continue to receive the original DATABASE_URL.
    const connectionUrl = new URL(databaseUrl);
    if (
      connectionUrl.hostname.endsWith('.pooler.supabase.com') &&
      connectionUrl.searchParams.get('sslmode') === 'require'
    ) {
      connectionUrl.searchParams.set('uselibpqcompat', 'true');
    }

    const adapter = new PrismaPg({
      connectionString: connectionUrl.toString(),
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
