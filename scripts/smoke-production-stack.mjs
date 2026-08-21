import { execFileSync } from "node:child_process";

const [baseUrl, postgresContainer] = process.argv.slice(2);
if (!baseUrl || !postgresContainer) {
  throw new Error(
    "Usage: smoke-production-stack.mjs <base-url> <postgres-container>",
  );
}

const email = "production-image-smoke@example.test";
const password = "ProductionImageSmoke!1234";
const cookies = new Map();

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("x-forwarded-proto", "https");
  if (cookies.size) {
    headers.set(
      "cookie",
      [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    redirect: "error",
  });
  for (const value of response.headers.getSetCookie?.() ?? []) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator > 0) {
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path}: HTTP ${response.status}`,
    );
  }
  const body = await response.text();
  return body ? JSON.parse(body) : undefined;
}

async function csrf() {
  const result = await request("/api/v1/auth/csrf-token");
  if (typeof result?.csrfToken !== "string")
    throw new Error("Missing CSRF token");
  return result.csrfToken;
}

function json(method, body, token) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-csrf-token": token } : {}),
    },
    body: JSON.stringify(body),
  };
}

await request(
  "/api/v1/auth/register",
  json(
    "POST",
    {
      email,
      name: "Production Image Smoke",
      password,
      locale: "en",
      base_currency: "PLN",
    },
    await csrf(),
  ),
);

execFileSync(
  "docker",
  [
    "exec",
    postgresContainer,
    "psql",
    "--username",
    "monqom",
    "--dbname",
    "monqom_container_ci",
    "--set",
    "ON_ERROR_STOP=1",
    "--command",
    `UPDATE users SET email_verified = true WHERE email = '${email}'`,
  ],
  { stdio: "ignore" },
);

await request(
  "/api/v1/auth/login",
  json("POST", { email, password }, await csrf()),
);

const token = await csrf();
const workspaces = await request("/api/v1/workspaces");
const workspaceId = workspaces?.[0]?.id;
if (typeof workspaceId !== "string") throw new Error("Missing workspace");

const goal = await request(
  `/api/v1/workspaces/${workspaceId}/goals`,
  json(
    "POST",
    {
      name: "Production image smoke goal",
      target_amount: 1000,
      initial_amount: 100,
      target_date: "2030-12-31",
      include_current_month: false,
    },
    token,
  ),
);
if (typeof goal?.id !== "string") throw new Error("Goal was not created");

const stored = await request(
  `/api/v1/workspaces/${workspaceId}/goals/${goal.id}`,
);
if (stored?.id !== goal.id) throw new Error("Goal could not be read back");

process.stdout.write("Production image critical journey passed\n");
