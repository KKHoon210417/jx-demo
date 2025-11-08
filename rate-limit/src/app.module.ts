import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitGuard } from './guard/rate-limit.guard';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [AppController],
  providers: [AppService, RateLimitGuard],
})
export class AppModule {}
