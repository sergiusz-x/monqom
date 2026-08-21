import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDigestReference,
  isRollbackSafeCompose,
  renderImmutableCompose,
} from "./deploy-dokploy.mjs";

const digest = (name, character) =>
  `ghcr.io/sergiusz-x/${name}@sha256:${character.repeat(64)}`;

test("renders exactly three immutable GHCR image references without build directives", () => {
  const template = `services:
  migrate:
    image: \${MIGRATION_IMAGE:?required}
  backend:
    image: \${BACKEND_IMAGE:?required}
  frontend:
    image: \${FRONTEND_IMAGE:?required}
`;
  const rendered = renderImmutableCompose(template, {
    migration: digest("monqom-migration", "a"),
    backend: digest("monqom-backend", "b"),
    frontend: digest("monqom-frontend", "c"),
  });

  assert.equal(isRollbackSafeCompose(rendered), true);
  assert.equal(rendered.includes("${"), false);
});

test("rejects moving tags, non-GHCR references, and source builds", () => {
  assert.throws(() =>
    assertDigestReference("ghcr.io/example/app:latest", "BACKEND_IMAGE"),
  );
  assert.throws(() =>
    assertDigestReference(
      "docker.io/example/app@sha256:" + "a".repeat(64),
      "X",
    ),
  );
  assert.equal(
    isRollbackSafeCompose(
      `services:\n  app:\n    build: .\n    image: ${digest("app", "a")}\n`,
    ),
    false,
  );
});
