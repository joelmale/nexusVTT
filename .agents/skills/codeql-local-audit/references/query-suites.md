# CodeQL Query Suites & SARIF Analysis Reference

This guide documents query suites, custom security queries, and SARIF parsing techniques for local audits.

---

## 1. Available Query Suites

In `codeql/javascript-queries`:
| Suite Name | Identifier | Focus Area |
| :--- | :--- | :--- |
| **Security and Quality** | `codeql-suites/javascript-security-and-quality.qls` | High-confidence security alerts (CWE), reliability issues, memory leaks, and high-severity bugs. |
| **Security Extended** | `codeql-suites/javascript-security-extended.qls` | Exhaustive security coverage, including lower-confidence or defense-in-depth alerts. |
| **Code Scanning** | `codeql-suites/javascript-code-scanning.qls` | Default rules enabled for GitHub Advanced Security code scanning. |

---

## 2. Useful Custom QL Queries

### A. Detect Dangerous `innerHTML` / `dangerouslySetInnerHTML`
```ql
import javascript

from PropWrite write, string prop
where
  write.getPropertyName() = prop and
  prop in ["innerHTML", "outerHTML"]
select write, "Direct assignment to " + prop + " may lead to Cross-Site Scripting (XSS)."
```

### B. Detect Unchecked `postMessage` Origin
```ql
import javascript

from MethodCallExpr call
where
  call.getMethodName() = "postMessage" and
  call.getArgument(1).getStringValue() = "*"
select call, "Sending postMessage with '*' wildcard target origin."
```

### C. Find Raw PostgreSQL String Interpolation
```ql
import javascript

from CallExpr call, Expr arg
where
  call.getCalleeName() in ["query", "execute"] and
  arg = call.getArgument(0) and
  (arg instanceof AddExpr or arg instanceof TemplateLiteral)
select call, "Potential SQL injection: Raw query constructed via string concatenation."
```

---

## 3. SARIF Severity Filtering Helper Script

Save and run this script to filter findings by severity level (`error`, `warning`, `note`):

```javascript
// parse-sarif.js
const fs = require('fs');

function analyzeSarif(sarifPath, minLevel = 'warning') {
  const levels = { error: 3, warning: 2, note: 1 };
  const minScore = levels[minLevel] || 2;

  const data = JSON.parse(fs.readFileSync(sarifPath, 'utf8'));
  const issues = [];

  for (const run of data.runs || []) {
    const rules = new Map(run.tool?.driver?.rules?.map(r => [r.id, r]) || []);

    for (const result of run.results || []) {
      const level = result.level || 'warning';
      if ((levels[level] || 1) >= minScore) {
        const ruleMeta = rules.get(result.ruleId);
        issues.push({
          ruleId: result.ruleId,
          level,
          title: ruleMeta?.shortDescription?.text || result.ruleId,
          message: result.message?.text,
          location: result.locations?.[0]?.physicalLocation?.artifactLocation?.uri,
          line: result.locations?.[0]?.physicalLocation?.region?.startLine,
        });
      }
    }
  }

  console.table(issues);
  return issues;
}

analyzeSarif('codeql-report.sarif', 'warning');
```
