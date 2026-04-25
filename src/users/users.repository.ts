import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './DTOs/CreateUser.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateUserDto) {
    return this.prisma.user.create({ data });
  }

  update(phone: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: {
        phone
      },
      data
    })
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  findByPhone(phone: string) {
   return this.prisma.user.findUnique({
    where: {
      phone
    }
   })
  }
}
