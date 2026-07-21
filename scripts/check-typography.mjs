import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoots = ["frontend/src", "backend/src"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const forbiddenCharacters = new Map([
  [String.fromCodePoint(0x2010), "Unicode hyphen"],
  [String.fromCodePoint(0x2011), "non-breaking hyphen"],
  [String.fromCodePoint(0x2012), "figure dash"],
  [String.fromCodePoint(0x2013), "en dash"],
  [String.fromCodePoint(0x2014), "em dash"],
  [String.fromCodePoint(0x2015), "horizontal bar"],
  [String.fromCodePoint(0x2212), "Unicode minus"],
]);
const violations = [];

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

for (const sourceRoot of sourceRoots) {
  const files = await collectSourceFiles(path.join(repositoryRoot, sourceRoot));
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const lines = content.split(/\r?\n/);

    for (const [character, label] of forbiddenCharacters) {
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        let column = lines[lineIndex].indexOf(character);
        while (column !== -1) {
          violations.push({
            file,
            line: lineIndex + 1,
            column: column + 1,
            label,
          });
          column = lines[lineIndex].indexOf(character, column + 1);
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    "Typography check failed. Replace forbidden Unicode punctuation with keyboard characters:",
  );
  for (const violation of violations) {
    console.error(
      `${path.relative(repositoryRoot, violation.file)}:${violation.line}:${violation.column} - ${violation.label}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log("Typography check passed.");
}
