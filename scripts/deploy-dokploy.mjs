import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DIGEST_REFERENCE = /^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/;

export function assertDigestReference(value, name) {
  if (!DIGEST_REFERENCE.test(value)) {
    throw new Error(`${name} must be a lowercase GHCR name@sha256 reference`);
  }
}

export function renderImmutableCompose(template, images) {
  const replacements = [
    ["MIGRATION_IMAGE", images.migration],
    ["BACKEND_IMAGE", images.backend],
    ["FRONTEND_IMAGE", images.frontend],
  ];

  let rendered = template;
  for (const [name, image] of replacements) {
    assertDigestReference(image, name);
    const expression = new RegExp(`\\$\\{${name}:[^}]+\\}`, "g");
    const matches = rendered.match(expression) ?? [];
    if (matches.length !== 1)
      throw new Error(`Expected exactly one ${name} placeholder`);
    rendered = rendered.replace(expression, image);
  }

  if (/^\s*build:/m.test(rendered)) {
    throw new Error(
      "Immutable deployment Compose must not contain build directives",
    );
  }
  return rendered;
}

export function isRollbackSafeCompose(compose) {
  if (typeof compose !== "string" || /^\s*build:/m.test(compose)) return false;
  const imageLines = [...compose.matchAll(/^\s*image:\s*(\S+)\s*$/gm)].map(
    (match) => match[1],
  );
  return (
    imageLines.length === 3 &&
    imageLines.every((image) => DIGEST_REFERENCE.test(image))
  );
}

async function api(path, options = {}) {
  const response = await fetch(`${requiredUrl("DOKPLOY_URL")}/api/${path}`, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "content-type": "application/json",
      "x-api-key": required("DOKPLOY_API_KEY"),
      ...options.headers,
    },
  });
  if (!response.ok)
    throw new Error(`Dokploy ${path} returned HTTP ${response.status}`);
  const body = await response.text();
  return body ? JSON.parse(body) : {};
}

async function updateCompose(composeFile) {
  await api("compose.update", {
    method: "POST",
    body: JSON.stringify({
      composeId: required("DOKPLOY_COMPOSE_ID"),
      composeFile,
      sourceType: "raw",
      autoDeploy: false,
    }),
  });
}

async function deploy(title) {
  await api("compose.deploy", {
    method: "POST",
    body: JSON.stringify({
      composeId: required("DOKPLOY_COMPOSE_ID"),
      title,
      description: "Digest-pinned release deployment",
    }),
  });
}

async function waitForRelease(
  expectedSha,
  attempts = 90,
  rejectedSha = undefined,
) {
  const productionUrl = requiredUrl("PRODUCTION_URL");
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const cacheBust = `deployment_check=${Date.now()}`;
      const [ready, version] = await Promise.all([
        fetch(`${productionUrl}/api/ready?${cacheBust}`, {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        }),
        fetch(`${productionUrl}/version.json?${cacheBust}`, {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        }),
      ]);
      if (ready.ok && version.ok) {
        const metadata = await version.json();
        if (expectedSha && metadata.sha === expectedSha) return;
        if (
          !expectedSha &&
          typeof metadata.sha === "string" &&
          metadata.sha !== rejectedSha
        )
          return;
      }
    } catch {
      // The old or starting deployment may briefly be unreachable.
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(
    "Production did not expose the expected healthy release before timeout",
  );
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredUrl(name) {
  const value = required(name).replace(/\/+$/, "");
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  return value;
}

async function main() {
  const composeId = required("DOKPLOY_COMPOSE_ID");
  const currentResponse = await api(
    `compose.one?composeId=${encodeURIComponent(composeId)}`,
  );
  const current = currentResponse.compose ?? currentResponse;
  const previousCompose = current.composeFile;
  const rollbackAvailable = isRollbackSafeCompose(previousCompose);

  const template = await readFile("docker-compose.immutable.yml", "utf8");
  const nextCompose = renderImmutableCompose(template, {
    migration: required("MIGRATION_IMAGE"),
    backend: required("BACKEND_IMAGE"),
    frontend: required("FRONTEND_IMAGE"),
  });
  const expectedSha = required("EXPECTED_GIT_SHA");
  if (!/^[a-f0-9]{40}$/.test(expectedSha)) {
    throw new Error("EXPECTED_GIT_SHA must be a full lowercase Git SHA");
  }

  try {
    await updateCompose(nextCompose);
    await deploy(`Release ${expectedSha.slice(0, 12)}`);
    await waitForRelease(expectedSha);
    process.stdout.write(`Production is healthy at ${expectedSha}\n`);
  } catch (deploymentError) {
    if (!rollbackAvailable) {
      throw new Error(
        "Deployment verification failed and no previous digest-pinned manifest is available; use the documented bootstrap recovery",
        { cause: deploymentError },
      );
    }

    process.stderr.write(
      "Deployment verification failed; restoring previous application images\n",
    );
    await updateCompose(previousCompose);
    await deploy(
      `Automatic application rollback after ${expectedSha.slice(0, 12)}`,
    );
    await waitForRelease(undefined, 60, expectedSha);
    throw new Error(
      "Deployment failed; the previous application manifest was restored",
      {
        cause: deploymentError,
      },
    );
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
