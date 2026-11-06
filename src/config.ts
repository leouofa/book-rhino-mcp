export interface BookRhinoConfig {
  originUrl: string;
  apiBaseUrl: string;
  apiKey: string;
  readOnly: boolean;
  allowAdmin: boolean;
  timeoutMs: number;
  operationTimeoutMs: number;
  pollIntervalMs: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

function parseBooleanFlag(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export function parseConfig(env: NodeJS.ProcessEnv = process.env): BookRhinoConfig {
  const rawUrl = env.BOOK_RHINO_URL?.trim();
  if (!rawUrl) {
    throw new Error(
      "Missing required environment variable: BOOK_RHINO_URL (e.g. http://localhost:3000 or http://localhost:3000/api/v1)"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL format in BOOK_RHINO_URL: "${rawUrl}"`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol in BOOK_RHINO_URL: "${parsed.protocol}" (expected http: or https:)`);
  }

  const apiKey = env.BOOK_RHINO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing required environment variable: BOOK_RHINO_API_KEY (create a personal token in Book Rhino at /api_tokens or via `bin/rails \"api_tokens:create[email,name]\"`)"
    );
  }

  const originUrl = parsed.origin;

  // Normalize path so apiBaseUrl always ends with /api/v1
  let path = parsed.pathname.replace(/\/+$/, "");
  if (path.endsWith("/api/v1")) {
    // already includes /api/v1
  } else if (path.endsWith("/api")) {
    path = `${path}/v1`;
  } else if (path === "" || path === "/") {
    path = "/api/v1";
  } else {
    path = `${path}/api/v1`;
  }

  const apiBaseUrl = `${originUrl}${path}`;

  return {
    originUrl,
    apiBaseUrl,
    apiKey,
    readOnly: parseBooleanFlag(env.BOOK_RHINO_READ_ONLY),
    allowAdmin: parseBooleanFlag(env.BOOK_RHINO_ALLOW_ADMIN),
    timeoutMs: parsePositiveInt(env.BOOK_RHINO_TIMEOUT_MS, 30000),
    operationTimeoutMs: parsePositiveInt(env.BOOK_RHINO_OPERATION_TIMEOUT_MS, 90000),
    pollIntervalMs: parsePositiveInt(env.BOOK_RHINO_POLL_INTERVAL_MS, 1500),
  };
}
