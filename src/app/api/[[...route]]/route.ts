import { Redis } from '@upstash/redis';
import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { handle } from 'hono/vercel';

export const runtime = 'edge';

const app = new Hono().basePath('/api');

type EnvConfig = {
  UPSTASH_REDIS_REST_TOKEN: string;
  UPSTASH_REDIS_REST_URL: string;
};

app.get('/search', async (ctx) => {
  try {

    console.log("abc")

    const { UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL } =
      env<EnvConfig>(ctx);

    const start = performance.now(); //starting time

    const redis = new Redis({
      token: UPSTASH_REDIS_REST_TOKEN,
      url: UPSTASH_REDIS_REST_URL,
    });

    const query = ctx.req.query('q')?.toUpperCase();

    if (!query)
      return ctx.json({ message: 'Invalid search query' }, { status: 400 });

    const response = [];
    const rank = await redis.zrank('terms', query);

    if (rank != null && rank != undefined) {
      const temp = await redis.zrange<string[]>('terms', rank, rank + 200);

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

export const GET = handle(app)
export default app as never;
