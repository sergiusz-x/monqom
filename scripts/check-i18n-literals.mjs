import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "../frontend/node_modules/typescript/lib/typescript.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repositoryRoot, "frontend", "src");
const checkedAttributes = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "placeholder",
  "title",
]);
const ignoredDirectories = new Set(["i18n", "test"]);
const violations = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)));
    else if (/\.tsx?$/.test(entry.name)) files.push(entryPath);
  }

  return files;
}

function isUserCopy(value) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized === "Monqom" || /^&[a-z]+;$/.test(normalized)) {
    return false;
  }
  return /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(normalized);
}

function addViolation(file, source, node, value) {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  violations.push({
    file,
    line: position.line + 1,
    column: position.character + 1,
    value: value.replace(/\s+/g, " ").trim(),
  });
}

for (const file of await collectFiles(sourceRoot)) {
  const content = await readFile(file, "utf8");
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (ts.isJsxText(node) && isUserCopy(node.getText(source))) {
      addViolation(file, source, node, node.getText(source));
    }

    if (
      ts.isJsxAttribute(node) &&
      checkedAttributes.has(node.name.getText(source)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      isUserCopy(node.initializer.text)
    ) {
      addViolation(file, source, node, node.initializer.text);
    }

    if (
      ts.isStringLiteral(node) &&
      ts.isJsxExpression(node.parent) &&
      isUserCopy(node.text)
    ) {
      addViolation(file, source, node, node.text);
    }

    if (ts.isTemplateExpression(node) && ts.isJsxExpression(node.parent)) {
      const attribute = node.parent.parent;
      const attributeName = ts.isJsxAttribute(attribute)
        ? attribute.name.getText(source)
        : null;
      const literalParts = [
        node.head.text,
        ...node.templateSpans.map((span) => span.literal.text),
      ].join(" ");
      if (
        (attributeName === null || checkedAttributes.has(attributeName)) &&
        isUserCopy(literalParts)
      ) {
        addViolation(file, source, node, literalParts);
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      const checkedArgument =
        name === "getApiErrorMessage"
          ? node.arguments[1]
          : name === "showToast" || /^set\w*Error$/.test(name)
            ? node.arguments[0]
            : null;
      if (
        checkedArgument &&
        ts.isStringLiteral(checkedArgument) &&
        isUserCopy(checkedArgument.text)
      ) {
        addViolation(file, source, checkedArgument, checkedArgument.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
}

if (violations.length > 0) {
  console.error(
    "i18n literal check failed. Move user-facing copy to the translation resources:",
  );
  for (const violation of violations) {
    console.error(
      `${path.relative(repositoryRoot, violation.file)}:${violation.line}:${violation.column} - ${JSON.stringify(violation.value)}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log("i18n literal check passed.");
}
