/**
 * Shared type surface for the assay-core Executa.
 *
 * Every type here is JSON-serialisable. The trial record, the verdict report
 * and the policy record are written verbatim into Anna Persistent Storage, so
 * nothing in this file may hold a class instance, a function or a Date.
 */
/** Every task lane, in display order. */
export const TASK_TYPES = ['draft', 'rewrite', 'extract', 'code', 'analyse'];
/** The three locked slots, in display order. */
export const LOCK_SLOTS = ['default', 'fallback', 'budget'];
/** The price table constant, surfaced in the verdict and bumped on any pricing change. */
export const PRICE_TABLE_VERSION = '2026-09-28.v1';
/** Rate limit window. Six trials per user per hour, held in APS. */
export const TRIAL_RATE_LIMIT = 6;
export const TRIAL_RATE_WINDOW_MS = 60 * 60 * 1000;
/** Key prefix for the hourly rate limit buckets. */
export const RATE_LIMIT_PREFIX = 'ratelimit/';
