import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const repositoryRoot = process.cwd();
const sourceRoot = path.join(repositoryRoot, 'src');
const scanRoots = ['src', 'server', 'services/asset-service/src', 'shared'].map(
  (directory) => path.join(repositoryRoot, directory),
);
const sourceExtensions = ['.ts', '.tsx'];

async function collectSourceFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(filePath, files);
    } else if (
      entry.isFile() &&
      sourceExtensions.includes(path.extname(entry.name)) &&
      !entry.name.includes('.test.') &&
      !entry.name.endsWith('.d.ts')
    ) {
      files.push(path.normalize(filePath));
    }
  }
  return files;
}

async function pathExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function resolveImport(fromFile, specifier, sourceFiles) {
  let basePath;
  if (specifier.startsWith('@/')) {
    basePath = path.join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    basePath = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }

  const candidates = [
    basePath,
    ...sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...sourceExtensions.map((extension) =>
      path.join(basePath, `index${extension}`),
    ),
  ];
  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (sourceFiles.has(normalized) || (await pathExists(normalized))) {
      return normalized;
    }
  }
  return null;
}

function moduleSpecifiers(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];
  for (const statement of sourceFile.statements) {
    if (
      (ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
}

function findStronglyConnectedComponents(graph) {
  let nextIndex = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];

  function visit(modulePath) {
    indices.set(modulePath, nextIndex);
    lowLinks.set(modulePath, nextIndex);
    nextIndex += 1;
    stack.push(modulePath);
    onStack.add(modulePath);

    for (const dependency of graph.get(modulePath) ?? []) {
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(
          modulePath,
          Math.min(lowLinks.get(modulePath), lowLinks.get(dependency)),
        );
      } else if (onStack.has(dependency)) {
        lowLinks.set(
          modulePath,
          Math.min(lowLinks.get(modulePath), indices.get(dependency)),
        );
      }
    }

    if (lowLinks.get(modulePath) !== indices.get(modulePath)) return;
    const component = [];
    let dependency;
    do {
      dependency = stack.pop();
      onStack.delete(dependency);
      component.push(dependency);
    } while (dependency !== modulePath);

    if (component.length > 1) cycles.push(component);
  }

  for (const modulePath of graph.keys()) {
    if (!indices.has(modulePath)) visit(modulePath);
  }
  return cycles;
}

const files = (
  await Promise.all(scanRoots.map((root) => collectSourceFiles(root)))
).flat();
const sourceFiles = new Set(files);
const graph = new Map();

for (const filePath of files) {
  const source = await readFile(filePath, 'utf8');
  const dependencies = [];
  for (const specifier of moduleSpecifiers(source, filePath)) {
    const dependency = await resolveImport(filePath, specifier, sourceFiles);
    if (dependency && sourceFiles.has(dependency))
      dependencies.push(dependency);
  }
  graph.set(filePath, dependencies);
}

const cycles = findStronglyConnectedComponents(graph);
if (cycles.length > 0) {
  console.error('Static import cycles detected:');
  for (const cycle of cycles) {
    console.error(
      `- ${cycle.map((filePath) => path.relative(repositoryRoot, filePath)).join(' -> ')}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(`No static import cycles across ${files.length} modules.`);
}
