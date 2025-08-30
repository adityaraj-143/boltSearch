import { Redis } from '@upstash/redis/cloudflare';
import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';

export const runtime = 'edge';

const app = new Hono().basePath('/api');

type EnvConfig = {
  UPSTASH_REDIS_REST_TOKEN: string;
  UPSTASH_REDIS_REST_URL: string;
};

app.use('/*', cors());

app.get('/search', async (ctx) => {
  try {
    const { UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL } =
      env<EnvConfig>(ctx);

    const start = performance.now(); //starting time

    const redis = new Redis({
      token: UPSTASH_REDIS_REST_TOKEN,
      url: UPSTASH_REDIS_REST_URL,
    });

    const query = ctx.req.query('q')?.toUpperCase();
    console.log('query: ', query);

    if (!query)
      return ctx.json({ message: 'Invalid search query' }, { status: 400 });

    const response = [];

    let rank = await redis.zrank('terms', query);
    if (rank == null) {
      rank = await redis.zrank('terms', query + '*');
    }

    if (rank != null && rank != undefined) {
      const temp = await redis.zrange<string[]>('terms', rank, rank + 50);
      console.log('results: ', temp);

      for (const el of temp) {
        if (!el.startsWith(query)) break;

        if (el.endsWith('*')) response.push(el.substring(0, el.length - 1));
      }
    }

    const end = performance.now(); // ending time

    return ctx.json({
      results: response,
      duration: end - start,
    });
  } catch (error) {
    console.error(error);

    return ctx.json(
      {
        results: [],
        message: 'Something went wrong',
      },
      { status: 500 }
    );
  }
});

export const GET = handle(app);
export default app as never;
