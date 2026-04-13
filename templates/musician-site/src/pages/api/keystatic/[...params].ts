import { makeGenericAPIRouteHandler } from "@keystatic/core/api/generic";
import type { APIContext } from "astro";
import config from "../../../../keystatic.config";

export const prerender = false;

const handler = makeGenericAPIRouteHandler({ config });

export const ALL = async (ctx: APIContext) => {
  const result = await handler(ctx.request);
  return new Response(result.body as BodyInit | null, {
    status: result.status,
    headers: result.headers as HeadersInit,
  });
};
