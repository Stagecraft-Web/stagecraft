import { z } from "zod";

/**
 * Contract between artist sites (the musician-site template) and the
 * platform's token broker. Mirror of templates/musician-site/src/lib/
 * publish-types.ts — keep both in sync until the contract moves to
 * @stagecraft/shared. See ADR-008.
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

export const PUBLISH_TOKEN_ERROR_CODES = [
  "missing-bearer",
  "invalid-body",
  "site-not-found",
  "invalid-secret",
  "app-suspended",
  "app-not-installed",
  "repo-not-configured",
  "github-app-misconfigured",
  "internal",
] as const;
export type PublishTokenErrorCode = (typeof PUBLISH_TOKEN_ERROR_CODES)[number];

export const publishTokenErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum(PUBLISH_TOKEN_ERROR_CODES),
  error: z.string().optional(),
});
export type PublishTokenError = z.infer<typeof publishTokenErrorSchema>;
