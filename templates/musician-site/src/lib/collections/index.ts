/**
 * Public API for the Collection abstraction (ADR-009).
 *
 * Callers should import from `@/lib/collections` rather than reaching
 * into the submodules directly so the surface stays curated.
 */

export * from "./types";
export * from "./zod";
export * from "./store";
export * from "./accessors";
