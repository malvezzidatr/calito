import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  update(phone: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { phone },
      data,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  deleteByPhone(phone: string) {
    return this.prisma.user.delete({
      where: { phone },
    });
  }
}
