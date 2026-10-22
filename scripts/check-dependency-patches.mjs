import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const braces = require("braces");
assert.deepEqual(braces.expand("{a,b}/{1..2}"), ["a/1", "a/2", "b/1", "b/2"]);
for (const [open, close] of [
  ["{", "}"],
  ["(", ")"],
]) {
  const pattern = open.repeat(128) + "a,b" + close.repeat(128);
  assert.throws(() => braces.parse(pattern), {
    name: "SyntaxError",
    message: "Pattern nesting exceeds the maximum depth of 100",
  });
}
console.log(
  "Dependency patches: bounded braces parsing and ordinary expansion passed.",
);
