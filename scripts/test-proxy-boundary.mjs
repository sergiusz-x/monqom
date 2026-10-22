import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { fileURLToPath } from "node:url";

const [nodeImage, frontendImage] = process.argv.slice(2);
if (!nodeImage || !frontendImage)
  throw new Error(
    "Usage: test-proxy-boundary.mjs <node-image> <frontend-image>",
  );
const traefikImage =
  "traefik:v3.6@sha256:31267173a15b4944e797a76ffd9c419707c8d8b32fe5b610f80cd0cfa05f372d";
const network = `monqom-proxy-test-${randomUUID()}`;
const containers = [];
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 60_000 }).trim();
const fixture = fileURLToPath(
  new URL("./fixtures/proxy-upstream.mjs", import.meta.url),
);
const routing = fileURLToPath(
  new URL("./fixtures/traefik-proxy-test.yml", import.meta.url),
);

function run(name, args) {
  docker("run", "-d", "--name", name, "--network", network, ...args);
  containers.push(name);
}
function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const secure = url.startsWith("https:");
    const send = secure ? httpsRequest : httpRequest;
    // Traefik generates an ephemeral self-signed certificate for this isolated test only.
    const options = {
      headers,
      timeout: 5000,
      ...(secure ? { rejectUnauthorized: false } : {}),
    };
    const outgoing = send(url, options, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          assert.equal(response.statusCode, 200);
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    outgoing.on("timeout", () =>
      outgoing.destroy(new Error("Proxy request timed out")),
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}

try {
  docker("network", "create", network);
  run(`${network}-upstream`, [
    "--network-alias",
    "backend",
    "--mount",
    `type=bind,source=${fixture},target=/proxy-upstream.mjs,readonly`,
    "--entrypoint",
    "node",
    nodeImage,
    "/proxy-upstream.mjs",
  ]);
  const frontend = `${network}-frontend`;
  run(frontend, ["--network-alias", "frontend", frontendImage]);
  const ports = JSON.parse(
    docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", frontend),
  );
  assert(
    Object.values(ports ?? {}).every((bindings) => bindings === null),
    "Origin must not publish host ports",
  );
  const ingress = `${network}-ingress`;
  run(ingress, [
    "-p",
    "127.0.0.1::8000",
    "-p",
    "127.0.0.1::8443",
    "--mount",
    `type=bind,source=${routing},target=/routing.yml,readonly`,
    traefikImage,
    "--entrypoints.web.address=:8000",
    "--entrypoints.websecure.address=:8443",
    "--providers.file.filename=/routing.yml",
  ]);
  const plainPort = docker("port", ingress, "8000/tcp").split(":").at(-1);
  const securePort = docker("port", ingress, "8443/tcp").split(":").at(-1);
  const plainUrl = `http://127.0.0.1:${plainPort}/api/proxy-probe`;
  const secureUrl = `https://127.0.0.1:${securePort}/api/proxy-probe`;
  let plain;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      plain = await request(plainUrl);
      break;
    } catch {
      /* Wait for proxy startup. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(plain, "Proxy chain did not become ready");
  assert.equal(plain.protocol, "http");
  const forged = await request(plainUrl, {
    "CF-Visitor": '{"scheme":"https"}',
    "X-Forwarded-Proto": "https",
    "X-Forwarded-For": "203.0.113.7",
    "X-Real-IP": "203.0.113.7",
  });
  assert.equal(forged.protocol, "http");
  assert.equal(forged.forwardedFor, plain.forwardedFor);
  assert(!forged.forwardedFor.includes("203.0.113.7"));
  assert.equal(
    (await request(plainUrl, { "X-Forwarded-Proto": "https,http" })).protocol,
    "http",
  );
  const secure = await request(secureUrl, {
    "CF-Visitor": '{"scheme":"http"}',
    "X-Forwarded-Proto": "http",
    "X-Forwarded-For": "203.0.113.7",
  });
  assert.equal(secure.protocol, "https");
  assert.equal(secure.forwardedFor, plain.forwardedFor);
  console.log(
    "Proxy boundary: real Traefik -> private nginx -> upstream; HTTPS and IP spoofing checks passed without ingress environment variables.",
  );
} finally {
  for (const name of containers.reverse()) docker("rm", "-f", name);
  try {
    docker("network", "rm", network);
  } catch {
    /* Preserve the original failure. */
  }
}
