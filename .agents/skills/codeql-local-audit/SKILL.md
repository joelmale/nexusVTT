---
name: codeql-local-audit
description: >-
  Executes local CodeQL static analysis and security audits using the CodeQL CLI and pre-built
  query suites (e.g. javascript-security-and-quality.qls) against databases or modified files.
  Parses SARIF results to surface security findings and auto-remediate common vulnerabilities
  (XSS, prototype pollution, ReDoS, unsafe deserialization, SQL injection) before PR submission.
---

# CodeQL Local Audit

Performs local semantic security scanning and static analysis on codebases using GitHub CodeQL. Identifies taint-tracking paths, vulnerability patterns, and code smells without needing remote CI/CD cycles.

## When to Use

Activate this skill when:
- Performing security pre-flight checks before opening a pull request or merging code.
- Auditing web endpoints, WebSocket listeners, or database queries for vulnerabilities.
- Investigating suspected vulnerabilities (XSS, SQL injection, prototype pollution, path traversal).
- Running CodeQL query suites locally or parsing SARIF output into actionable code fixes.

---

## Environment & Tooling Setup

- **CodeQL CLI Executable**:
  ```powershell
  $codeql = "$env:APPDATA\Antigravity IDE\User\globalStorage\github.vscode-codeql\distribution1\codeql\codeql.exe"
  ```
- **Local Database Path**:
  The extension stores downloaded/extracted databases under workspace storage:
  ```powershell
  $db = (Get-ChildItem -Path "$env:APPDATA\Antigravity IDE\User\workspaceStorage" -Recurse -Filter "codeql-database.yml" | Select-Object -First 1).Directory.FullName
  ```
- **Installed Query Packs**:
  Standard JavaScript/TypeScript security suites are available via `codeql/javascript-queries`:
  - `codeql-suites/javascript-security-and-quality.qls` (Recommended for full audits)
  - `codeql-suites/javascript-security-extended.qls` (Recommended for security-critical PRs)

---

## Standard Scanning Workflow

### 1. Run Query Suite to SARIF
Execute an audit on the current database and generate a SARIF report:
```powershell
& $codeql database analyze $db `
  "codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls" `
  --format=sarif-latest `
  --output=codeql-report.sarif `
  --threads=0
```

### 2. Parse SARIF Findings
Extract actionable alerts (file path, line number, rule ID, and message) using Node or PowerShell:
```powershell
node -e "
const fs = require('fs');
const sarif = JSON.parse(fs.readFileSync('codeql-report.sarif', 'utf8'));
const runs = sarif.runs || [];
let count = 0;
for (const run of runs) {
  for (const res of run.results || []) {
    count++;
    const rule = res.ruleId;
    const msg = res.message.text;
    const loc = res.locations?.[0]?.physicalLocation;
    const file = loc?.artifactLocation?.uri;
    const line = loc?.region?.startLine;
    console.log(\`[\${rule}] \${file}:\${line} - \${msg}\`);
  }
}
console.log(\`Total findings: \${count}\`);
"
```

### 3. Quick Query Single-Rule Scan
To run an ad-hoc `.ql` query or test a specific taint source:
```powershell
& $codeql query run path/to/query.ql `
  --database=$db `
  --output=results.bqrs

& $codeql bqrs decode results.bqrs --format=csv --output=results.csv
```

---

## Common Vulnerability Remediation

For detailed patterns, see [query-suites.md](./references/query-suites.md).

1. **Cross-Site Scripting (DOM XSS / Unsafe HTML Injection)**:
   - **Vulnerable**: `element.innerHTML = untrustedData;`
   - **Remediation**: Use `element.textContent = untrustedData;` or sanitize via `DOMPurify.sanitize(untrustedData)`.
2. **Path Traversal / Arbitrary File Read**:
   - **Vulnerable**: `path.join(uploadDir, req.params.filename);`
   - **Remediation**: Validate with `path.resolve` and assert that the target starts with the intended parent directory (`resolvedPath.startsWith(uploadDir)`).
3. **Insecure Regular Expressions (ReDoS)**:
   - **Vulnerable**: Polynomial/exponential backtracking patterns (e.g. `^([a-zA-Z0-9]+)*$`).
   - **Remediation**: Simplify pattern or utilize non-backtracking alternatives / input length validation.
4. **Prototype Pollution**:
   - **Remediation**: Use `Object.create(null)` or validate `key !== '__proto__'` and `key !== 'constructor'`.
