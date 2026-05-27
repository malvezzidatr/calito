import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParsedFood } from './utils/meal.parser.prompt';

type UpsertInput = {
  normalized_text: string;
  foods:           ParsedFood[];
  meal_type:       string | null;
};

@Injectable()
export class ParsedMessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByText(normalized_text: string) {
    return this.prisma.parsedMessageCache.findUnique({
      where: { normalized_text },
    });
  }

  upsert(data: UpsertInput) {
    return this.prisma.parsedMessageCache.upsert({
      where:  { normalized_text: data.normalized_text },
      create: {
        normalized_text: data.normalized_text,
        foods:           data.foods as unknown as object,
        meal_type:       data.meal_type,
      },
      update: {},
    });
  }
}
