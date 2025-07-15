import { NextResponse } from 'next/server';
import redis from '@/lib/redisClient';
import { getTimingStats } from '@/lib/utils';

export async function GET() {
  const endpoint = 'api:chat';
  const [timing, requests, cacheHit, cacheMiss] = await Promise.all([
    getTimingStats(endpoint),
    redis.get(`metrics:${endpoint}:requests`),
    redis.get(`metrics:${endpoint}:cache_hit`),
    redis.get(`metrics:${endpoint}:cache_miss`),
  ]);
  return NextResponse.json({
    endpoint,
    avgResponseMs: timing.avg,
    totalRequests: parseInt(requests || '0', 10),
    cacheHit: parseInt(cacheHit || '0', 10),
    cacheMiss: parseInt(cacheMiss || '0', 10),
    cacheHitRate: (parseInt(cacheHit || '0', 10) + parseInt(cacheMiss || '0', 10)) > 0 ?
      (parseInt(cacheHit || '0', 10) / (parseInt(cacheHit || '0', 10) + parseInt(cacheMiss || '0', 10))) : 0,
  });
} 