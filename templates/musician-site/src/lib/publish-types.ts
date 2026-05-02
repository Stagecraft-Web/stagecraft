import { z } from "zod";

/**
 * Contract between the artist site and the platform's token broker.
 *
 * - Artist site POSTs to the broker with its session token (cookie) and a siteId.
 * - Broker validates, mints a GitHub installation token, and returns it along
 *   with the target repo. Token is short-lived (~1hr).
 *
 * See ADR-008 for the full design.
 */
export const publishTokenRequestSchema = z.object({
  siteId: z.string().min(1),
});
export type PublishTokenRequest = z.infer<typeof publishTokenRequestSchema>;

export const publishTokenResponseSchema = z.object({
  ok: z.literal(true),
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
  repo: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
  }),
});
export type PublishTokenResponse = z.infer<typeof publishTokenResponseSchema>;

/** Request body sent from the editor to /api/publish on the artist site. */
export const publishRequestSchema = z.object({
  pageSlug: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  data: z.unknown(),
});
export type PublishRequest = z.infer<typeof publishRequestSchema>;

export const publishResponseSchema = z.object({
  ok: z.literal(true),
  commitSha: z.string().nullable(),
});
export type PublishResponse = z.infer<typeof publishResponseSchema>;

export const publishErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  code: z.enum([
    "unauthorized",
    "broker-unreachable",
    "broker-rejected",
    "github-failed",
    "validation-failed",
    "no-platform-configured",
  ]),
});
export type PublishError = z.infer<typeof publishErrorSchema>;
