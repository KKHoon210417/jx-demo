import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { REDIS } from 'src/redis/redis.module';

interface IAuthUser {
  id: string;
}

interface IAuthenticatedRequest extends Request {
  user?: IAuthUser;
}

type EvalResult = readonly [ok: 0 | 1, waitMs: number, tokens: number, timeToFull: number];

const isEvalResult = (x: unknown): x is EvalResult => {
  return (
    Array.isArray(x) &&
    x.length === 4 &&
    (x[0] === 0 || x[0] === 1) &&
    typeof x[1] === 'number' &&
    Number.isFinite(x[1]) &&
    typeof x[2] === 'number' &&
    Number.isFinite(x[2]) &&
    typeof x[3] === 'number' &&
    Number.isFinite(x[3])
  );
};

// assertion function은 function으로 선언해야됨.
function assertString(x: unknown): asserts x is string {
  if (typeof x !== 'string') {
    throw new Error('SCRIPT LOAD should return SHA string');
  }
}

const LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])

local t = redis.call('HGET', key, 'tokens')
local l = redis.call('HGET', key, 'last')
local tokens = tonumber(t) or capacity
local last = tonumber(l) or nowMs

local elapsed = math.max(0, nowMs - last)
tokens = math.min(capacity, tokens + (elapsed/1000.0) * rate)

if tokens < 1.0 then
  local waitMs = math.ceil((1.0 - tokens) * 1000.0 / rate)
  local timeToFull = math.ceil((capacity - tokens) / rate)

  redis.call('HSET', key, 'tokens', tokens, 'last', nowMs)
  local ttlMs = math.max(1000, timeToFull * 2000)
  redis.call('PEXPIRE', key, ttlMs)

  return {0, waitMs, tokens, timeToFull}
end

tokens = tokens - 1.0
redis.call('HSET', key, 'tokens', tokens, 'last', nowMs)

local timeToFull = math.ceil((capacity - tokens) / rate)
local ttlMs = math.max(1000, timeToFull * 2000)
redis.call('PEXPIRE', key, ttlMs)

return {1, 0, tokens, timeToFull}
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private sha?: string;
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private async load(): Promise<string> {
    if (!this.sha || process.env.RL_RELOAD === '1') {
      const shaRaw = await this.redis.script('LOAD', LUA);
      assertString(shaRaw);
      this.sha = shaRaw;
    }
    return this.sha;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<IAuthenticatedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();

    const headerUserId = req.header('x-user-id');
    const userId = String(req.user?.id ?? headerUserId ?? 'anonymous');

    const routeKey = req.path;
    const key = `rl:${routeKey}:${userId}`;

    const capacity = 20; // Y
    const rate = 10; // X

    // Capacity 20, Rate 10
    const raw = await this.redis.evalsha(await this.load(), 1, key, String(capacity), String(rate), String(Date.now()));

    if (!isEvalResult(raw)) {
      throw new Error('Unexpected evalsha return');
    }

    const [ok, waitMs, tokens, timeToFullSec] = raw;
    // 공통 표준 헤더
    const remaining = Math.max(0, Math.floor(tokens));
    res.setHeader('RateLimit-Limit', String(capacity));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(timeToFullSec));

    if (ok === 1) {
      return true;
    }

    const retryAfterSec = Math.max(1, Math.ceil(waitMs / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      statusCode: 'RATE_LIMITED',
      retryAfter: retryAfterSec,
    });
    return false;
  }
}
