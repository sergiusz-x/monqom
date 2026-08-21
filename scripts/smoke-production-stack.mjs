import { execFileSync } from "node:child_process";

const [
  baseUrl,
  postgresContainer,
  databaseUser = "monqom",
  databaseName = "monqom_container_ci",
] = process.argv.slice(2);

if (!baseUrl || !postgresContainer) {
  throw new Error(
    "Usage: node scripts/smoke-production-stack.mjs <base-url> <postgres-container> [database-user] [database-name]",
  );
}

const smokeEmail = "production-image-smoke@example.test";
const smokePassword = "ProductionImageSmoke!1234";
const cookies = new Map();

function rememberCookies(response) {
  const combinedHeader = response.headers.get("set-cookie");
  const setCookies =
    response.headers.getSetCookie?.() ??
    (combinedHeader ? [combinedHeader] : []);
  for (const value of setCookies) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0)
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("x-forwarded-proto", "https");
  const cookie = cookieHeader();
  if (cookie) headers.set("cookie", cookie);

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    redirect: "error",
  });
  rememberCookies(response);
  const body = await response.text();

  if (!response.ok) {
    let code = "";
    try {
      const payload = JSON.parse(body);
      if (typeof payload?.code === "string") code = ` (${payload.code})`;
    } catch {
      // Do not include arbitrary response bodies in CI output.
    }
    throw new Error(
      `${options.method ?? "GET"} ${path} returned HTTP ${response.status}${code}`,
    );
  }

  return body ? JSON.parse(body) : undefined;
}

async function csrfToken() {
  const payload = await api("/api/v1/auth/csrf-token");
  if (typeof payload?.csrfToken !== "string" || payload.csrfToken.length < 32) {
    throw new Error("The API did not issue a valid CSRF token");
  }
  return payload.csrfToken;
}

function jsonRequest(method, body, csrf) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: JSON.stringify(body),
  };
}

const registrationCsrf = await csrfToken();
await api(
  "/api/v1/auth/register",
  jsonRequest(
    "POST",
    {
      email: smokeEmail,
      name: "Production Image Smoke",
      password: smokePassword,
      locale: "en",
      base_currency: "PLN",
    },
    registrationCsrf,
  ),
);

execFileSync(
  "docker",
  [
    "exec",
    postgresContainer,
    "psql",
    "--username",
    databaseUser,
    "--dbname",
    databaseName,
    "--set",
    "ON_ERROR_STOP=1",
    "--command",
    `UPDATE users SET email_verified = true WHERE email = '${smokeEmail}'`,
  ],
  { stdio: "ignore" },
);

const loginCsrf = await csrfToken();
await api(
  "/api/v1/auth/login",
  jsonRequest(
    "POST",
    { email: smokeEmail, password: smokePassword },
    loginCsrf,
  ),
);

const authenticatedCsrf = await csrfToken();
const workspaces = await api("/api/v1/workspaces");
const workspaceId = workspaces?.[0]?.id;
if (typeof workspaceId !== "string")
  throw new Error("Registration did not create a workspace");

const goal = await api(
  `/api/v1/workspaces/${workspaceId}/goals`,
  jsonRequest(
    "POST",
    {
      name: "Production image smoke goal",
      target_amount: 1000,
      initial_amount: 100,
      target_date: "2030-12-31",
      include_current_month: false,
    },
    authenticatedCsrf,
  ),
);

if (typeof goal?.id !== "string")
  throw new Error("Goal creation did not return an id");

const storedGoal = await api(
  `/api/v1/workspaces/${workspaceId}/goals/${goal.id}`,
);
if (
  storedGoal?.id !== goal.id ||
  storedGoal?.name !== "Production image smoke goal"
) {
  throw new Error("The created goal could not be read back");
}

process.stdout.write("Production image critical journey passed\n");
