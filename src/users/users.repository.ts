import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './DTOs/CreateUser.dto';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateUserDto) {
    return this.prisma.user.create({ data });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { created_at: 'desc' },
    });
  }
}
