import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface ImportViolation {
  file: string;
  specifier: string;
  reason: string;
}

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^"']+\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const forbiddenExternalImports = [/^@nestjs\//, /^typeorm(?:\/|$)/];

const forbiddenInternalSegmentsByLayer = {
  domain: [
    "/application/",
    "/database/",
    "/infrastructure/",
    "/integrations/",
    "/observability/",
    "/presentation/",
    "/repositories/"
  ],
  application: [
    "/database/",
    "/infrastructure/",
    "/integrations/",
    "/observability/",
    "/presentation/",
    "/repositories/"
  ]
} as const;

const temporaryLegacyBoundaryExceptions = new Set<string>();

describe("architecture dependency rules", () => {
  it("keeps domain and application independent from frameworks and adapters", async () => {
    const files = [
      ...(await listTypeScriptFiles(path.join(sourceRoot, "domain"))),
      ...(await listTypeScriptFiles(path.join(sourceRoot, "application")))
    ];

    const violations = await collectViolations(files);
    const unexpectedViolations = violations.filter(
      (violation) => !temporaryLegacyBoundaryExceptions.has(violation.file)
    );

    expect(formatViolations(unexpectedViolations)).toEqual([]);
  });
});

async function collectViolations(files: string[]): Promise<ImportViolation[]> {
  const violations: ImportViolation[] = [];
  for (const file of files) {
    const layer = readLayer(file);
    const source = await readFile(file, "utf8");
    for (const specifier of readImportSpecifiers(source)) {
      const reason = readForbiddenImportReason(file, layer, specifier);
      if (reason !== null) {
        violations.push({
          file: normalizeProjectPath(file),
          specifier,
          reason
        });
      }
    }
  }
  return violations;
}

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(entryPath);
      }
      if (entry.isFile() && entry.name.endsWith(".ts")) {
        return [entryPath];
      }
      return [];
    })
  );
  return files.flat();
}

function readImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function readForbiddenImportReason(
  file: string,
  layer: keyof typeof forbiddenInternalSegmentsByLayer,
  specifier: string
): string | null {
  const externalViolation = forbiddenExternalImports.find((pattern) => pattern.test(specifier));
  if (externalViolation !== undefined) {
    return `external import matches ${externalViolation}`;
  }

  if (!specifier.startsWith(".")) {
    return null;
  }

  const resolvedImport = normalizeProjectPath(path.resolve(path.dirname(file), specifier));
  const forbiddenSegment = forbiddenInternalSegmentsByLayer[layer].find((segment) =>
    resolvedImport.includes(segment)
  );
  return forbiddenSegment === undefined ? null : `relative import crosses into ${forbiddenSegment}`;
}

function readLayer(file: string): keyof typeof forbiddenInternalSegmentsByLayer {
  const normalizedFile = normalizeProjectPath(file);
  if (normalizedFile.includes("/src/domain/")) {
    return "domain";
  }
  return "application";
}

function normalizeProjectPath(value: string): string {
  return path.relative(projectRoot, value).replaceAll(path.sep, "/");
}

function formatViolations(violations: ImportViolation[]): string[] {
  return violations.map(
    (violation) => `${violation.file} imports ${violation.specifier}: ${violation.reason}`
  );
}
