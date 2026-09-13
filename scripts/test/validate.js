// validate.js – static analysis for the scripts-economy codebase
// Run with: node scripts/test/validate.js
// Exit code 0 = all checks passed, 1 = failures

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..'); // scripts directory

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) results = results.concat(walk(full));
    else if (full.endsWith('.js')) results.push(full);
  });
  return results;
}

function readFile(fp) {
  return fs.readFileSync(fp, 'utf8');
}

function checkSyntax(files) {
  const fail = [];
  files.forEach((fp) => {
    try {
      execSync(`node -c "${fp}"`, { stdio: 'ignore' });
    } catch (e) {
      fail.push({ file: fp, error: e.message });
    }
  });
  return { pass: files.length - fail.length, fail };
}

function resolveImport(spec, fromDir) {
  if (spec.startsWith('@') || spec.startsWith('minecraft')) return { external: true };
  let rel = spec;
  if (!rel.endsWith('.js')) rel += '.js';
  const candidate = path.resolve(fromDir, rel);
  if (fs.existsSync(candidate)) return { path: candidate, exists: true };
  // try index.js in directory
  const idx = path.resolve(fromDir, spec, 'index.js');
  if (fs.existsSync(idx)) return { path: idx, exists: true };
  return { path: candidate, exists: false };
}

function checkImports(files) {
  const fail = [];
  files.forEach((fp) => {
    const content = readFile(fp);
    const importRegex = /import\s+[^;]*?from\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      const spec = m[1];
      const resolved = resolveImport(spec, path.dirname(fp));
      if (!resolved.external && !resolved.exists) {
        fail.push({ file: fp, spec, resolved: resolved.path });
      }
    }
  });
  return { fail };
}

function checkDuplicateExports(files) {
  const fail = [];
  const exportRegex = /export\s+(?:function|const|let|var|class)\s+(\w+)/g;
  files.forEach((fp) => {
    const content = readFile(fp);
    const names = {};
    let m;
    while ((m = exportRegex.exec(content)) !== null) {
      const name = m[1];
      if (names[name]) fail.push({ file: fp, name });
      names[name] = true;
    }
  });
  return { fail };
}

function buildImportGraph(files) {
  const graph = {};
  files.forEach((fp) => {
    graph[fp] = [];
    const content = readFile(fp);
    const importRegex = /import\s+[^;]*?from\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      const spec = m[1];
      const resolved = resolveImport(spec, path.dirname(fp));
      if (!resolved.external && resolved.exists) {
        graph[fp].push(resolved.path);
      }
    }
  });
  return graph;
}

function detectCycles(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  const cycles = [];
  Object.keys(graph).forEach((k) => (color[k] = WHITE));
  const dfs = (node, stack) => {
    color[node] = GRAY;
    stack.push(node);
    for (const nbr of graph[node]) {
      if (color[nbr] === GRAY) {
        const idx = stack.indexOf(nbr);
        cycles.push(stack.slice(idx).concat(nbr));
      } else if (color[nbr] === WHITE) {
        dfs(nbr, stack);
      }
    }
    stack.pop();
    color[node] = BLACK;
  };
  Object.keys(graph).forEach((n) => {
    if (color[n] === WHITE) dfs(n, []);
  });
  return cycles;
}

function checkSafeAsyncImport(files) {
  const fail = [];
  files.forEach((fp) => {
    if (fp.endsWith('asyncUtils.js')) return; // definition file
    const content = readFile(fp);
    if (!/safeAsync\s*\(/.test(content)) return; // no usage
    const hasImport = /import\s+\{[^}]*safeAsync[^}]*\}\s+from\s+['"][^'"]+['"]/.test(content);
    if (!hasImport) fail.push({ file: fp, reason: 'uses safeAsync but no import' });
  });
  return { fail };
}

function checkGetContainerSize(files) {
  const callSites = [];
  files.forEach((fp) => {
    const content = readFile(fp);
    if (/getContainerSize\s*\(/.test(content)) callSites.push(fp);
  });
  // definition
  const defFiles = files.filter((fp) => /function\s+getContainerSize/.test(readFile(fp)));
  const defined = defFiles.length > 0;
  return { defined, callSites, defFiles };
}

function checkBankBalance(files) {
  const econFile = files.find((fp) => fp.endsWith('economyUtils.js'));
  const econContent = readFile(econFile);
  const exported = /export\s+function\s+getBankBalance/.test(econContent);
  const importers = [];
  files.forEach((fp) => {
    const content = readFile(fp);
    if (/import\s+\{[^}]*getBankBalance[^}]*\}\s+from\s+['"][^'"]+economyUtils['"]/ .test(content)) {
      importers.push(fp);
    }
  });
  return { exported, econFile, importers };
}

function checkPlayerLookup(files) {
  const file = files.find((fp) => fp.endsWith('playerUtils.js'));
  const content = readFile(file);
  const required = ['findOnlinePlayerById', 'findOnlinePlayerByName', 'findOnlinePlayerByIdOrName'];
  const missing = required.filter((name) => !new RegExp(`export\s+function\s+${name}\b`).test(content));
  return { file, missing };
}

function main() {
  const files = walk(ROOT);
  console.log(`Scanning ${files.length} .js files`);

  const results = {};
  results.syntax = checkSyntax(files);
  results.imports = checkImports(files);
  results.duplicates = checkDuplicateExports(files);
  const graph = buildImportGraph(files);
  const cycles = detectCycles(graph);
  results.cycles = { cycles };
  results.safeAsyncImport = checkSafeAsyncImport(files);
  results.containerSize = checkGetContainerSize(files);
  results.bankBalance = checkBankBalance(files);
  results.playerLookup = checkPlayerLookup(files);

  let totalFails = 0;
  // Report
  console.log('\n=== Report ===');
  console.log(`[1] Syntax validation: ${results.syntax.fail.length} failures`);
  totalFails += results.syntax.fail.length;
  console.log(`[2] Import resolution: ${results.imports.fail.length} failures`);
  totalFails += results.imports.fail.length;
  console.log(`[3] Duplicate exports: ${results.duplicates.fail.length} failures`);
  totalFails += results.duplicates.fail.length;
  console.log(`[4] Circular imports: ${results.cycles.cycles.length} cycles`);
  totalFails += results.cycles.cycles.length;
  console.log(`[5] safeAsync missing import: ${results.safeAsyncImport.fail.length} failures`);
  totalFails += results.safeAsyncImport.fail.length;
  console.log(`[6] getContainerSize defined: ${results.containerSize.defined ? 'YES' : 'NO'}`);
  if (!results.containerSize.defined) totalFails++;
  console.log(`[7] getBankBalance exported: ${results.bankBalance.exported ? 'YES' : 'NO'}`);
  if (!results.bankBalance.exported) totalFails++;
  console.log(`[8] player lookup exports missing: ${results.playerLookup.missing.length}`);
  if (results.playerLookup.missing.length) totalFails++;

  if (totalFails === 0) {
    console.log('\nALL CHECKS PASSED');
    process.exit(0);
  } else {
    console.log('\nFAILURES DETECTED');
    process.exit(1);
  }
}

main();
