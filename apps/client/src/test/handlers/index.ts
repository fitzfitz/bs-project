import type { RequestHandler } from "msw";

/**
 * Default MSW handlers shared across client tests.
 * Feature-specific handlers are added per test file via server.use().
 */
export const handlers: RequestHandler[] = [];
