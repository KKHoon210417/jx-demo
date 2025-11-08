import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS = 'REDIS';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: () => {
        const client = new Redis(process.env.REDIS_URL ?? DEFAULT_REDIS_URL);
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly client: Redis) {}
  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // noop
    }
  }
}
