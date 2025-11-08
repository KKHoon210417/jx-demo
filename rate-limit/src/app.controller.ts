import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { RateLimitGuard } from './guard/rate-limit.guard';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('foo')
  @UseGuards(RateLimitGuard)
  foo() {
    return {
      ok: true,
      at: Date.now(),
    };
  }
}
