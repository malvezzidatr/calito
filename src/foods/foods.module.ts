import { Module } from '@nestjs/common';
import { FoodsService } from './foods.service';

@Module({
  providers: [FoodsService],
  exports: [FoodsService],
})
export class FoodsModule {}
