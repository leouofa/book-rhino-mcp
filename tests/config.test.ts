import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("normalizes root origin URL to /api/v1 and applies sensible defaults", () => {
    const cfg = parseConfig({
      BOOK_RHINO_URL: "http://localhost:3000/",
      BOOK_RHINO_API_KEY: "br_live_secret123",
    });

    expect(cfg.originUrl).toBe("http://localhost:3000");
    expect(cfg.apiBaseUrl).toBe("http://localhost:3000/api/v1");
    expect(cfg.apiKey).toBe("br_live_secret123");
    expect(cfg.readOnly).toBe(false);
    expect(cfg.allowAdmin).toBe(false);
    expect(cfg.timeoutMs).toBe(30000);
    expect(cfg.operationTimeoutMs).toBe(90000);
    expect(cfg.pollIntervalMs).toBe(1500);
  });

  it("preserves explicit /api/v1, /api, and nested subpath prefixes", () => {
    expect(
      parseConfig({
        BOOK_RHINO_URL: "https://rhino.example.com/api/v1/",
        BOOK_RHINO_API_KEY: "br_live_1",
      }).apiBaseUrl
    ).toBe("https://rhino.example.com/api/v1");

    expect(
      parseConfig({
        BOOK_RHINO_URL: "https://rhino.example.com/api",
        BOOK_RHINO_API_KEY: "br_live_1",
      }).apiBaseUrl
    ).toBe("https://rhino.example.com/api/v1");

    expect(
      parseConfig({
        BOOK_RHINO_URL: "https://rhino.example.com/studio",
        BOOK_RHINO_API_KEY: "br_live_1",
      }).apiBaseUrl
    ).toBe("https://rhino.example.com/studio/api/v1");
  });

  it("parses boolean and numeric flags accurately", () => {
    const cfg = parseConfig({
      BOOK_RHINO_URL: "http://localhost:3000",
      BOOK_RHINO_API_KEY: "br_live_abc",
      BOOK_RHINO_READ_ONLY: "1",
      BOOK_RHINO_ALLOW_ADMIN: "true",
      BOOK_RHINO_TIMEOUT_MS: "15000",
      BOOK_RHINO_OPERATION_TIMEOUT_MS: "120000",
      BOOK_RHINO_POLL_INTERVAL_MS: "500",
    });

    expect(cfg.readOnly).toBe(true);
    expect(cfg.allowAdmin).toBe(true);
    expect(cfg.timeoutMs).toBe(15000);
    expect(cfg.operationTimeoutMs).toBe(120000);
    expect(cfg.pollIntervalMs).toBe(500);
  });

  it("throws clear errors when required env vars are missing or malformed", () => {
    expect(() => parseConfig({})).toThrow(/Missing required environment variable: BOOK_RHINO_URL/);
    expect(() =>
      parseConfig({ BOOK_RHINO_URL: "not-a-url", BOOK_RHINO_API_KEY: "br_live_x" })
    ).toThrow(/Invalid URL format/);
    expect(() =>
      parseConfig({ BOOK_RHINO_URL: "ftp://example.com", BOOK_RHINO_API_KEY: "br_live_x" })
    ).toThrow(/Unsupported URL protocol/);
    expect(() => parseConfig({ BOOK_RHINO_URL: "http://localhost:3000" })).toThrow(
      /Missing required environment variable: BOOK_RHINO_API_KEY/
    );
  });
});
