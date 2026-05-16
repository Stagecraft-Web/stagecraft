import { z } from "zod";

/**
 * Shared types for `POST /api/broker/deploy-status` — the broker-authed
 * passthrough that artist sites call to learn their own deploy state.
 * The artist-site mirror lives at
 * `templates/musician-site/src/lib/publish-status-types.ts`; both files
 * agree on the wire shape (the artist site can't import from `apps/web`
 * directly — different package boundaries).
 */

export const deployStatusBrokerRequestSchema = z.object({
  siteId: z.string().min(1),
});

export type DeployStatusBrokerRequest = z.infer<typeof deployStatusBrokerRequestSchema>;

export type DeployStatusBrokerErrorCode =
  | "missing-bearer"
  | "invalid-body"
  | "site-not-found"
  | "invalid-secret"
  | "provider-failed";

export type DeployStatusBrokerError = {
  ok: false;
  code: DeployStatusBrokerErrorCode;
  error?: string;
};

export type DeployState = "queued" | "building" | "ready" | "error" | "unknown";

export type DeployStatusBrokerSuccess = {
  ok: true;
  deploy: {
    id: string | null;
    state: DeployState;
    url: string | null;
    errorMessage?: string | null;
    createdAt: string | null;
  };
};

export type DeployStatusBrokerResponse = DeployStatusBrokerSuccess | DeployStatusBrokerError;
