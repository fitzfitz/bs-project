import "@testing-library/jest-dom/vitest";
import i18n from "@/i18n/config";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

beforeAll(async () => {
  await i18n.changeLanguage("en");
  server.listen({ onUnhandledRequest: "warn" });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
