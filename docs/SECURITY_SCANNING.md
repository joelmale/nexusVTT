# Security Scanning Setup Guide

This project includes comprehensive security scanning via GitHub Actions. Here's how to set up and manage the security tools.

## Security Tools Included

1. **CodeQL** - GitHub's code analysis (✅ No setup needed)
2. **Snyk** - Vulnerability scanning (⚙️ Requires token)
3. **Trivy** - Container scanning (✅ No setup needed)
4. **Grype** - Additional container scanning (✅ No setup needed)
5. **OWASP Dependency Check** - Dependency vulnerabilities (✅ No setup needed)
6. **TruffleHog** - Secret scanning (✅ No setup needed)
7. **Gitleaks** - Secret detection (✅ No setup needed)

## Quick Setup: Snyk Token

Snyk requires an API token to run scans:

### Step 1: Get Your Snyk Token

1. Go to [snyk.io](https://snyk.io) and create a free account
2. Navigate to **Account Settings** → **General** → **API Token**
3. Click **Show** and copy your token

### Step 2: Add to GitHub Secrets

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - **Name:** `SNYK_TOKEN`
   - **Value:** Your Snyk API token
5. Click **Add secret**

### Step 3: Re-run Failed Workflow

Once the token is added, the security scans will pass.

---

## What Each Tool Scans

### CodeQL (SAST - Static Application Security Testing)
- **What:** Analyzes source code for security vulnerabilities
- **Languages:** JavaScript, TypeScript
- **Setup:** None required (GitHub native)
- **Reports:** GitHub Security tab

### Snyk
- **What:** Scans code and dependencies for known vulnerabilities
- **Coverage:**
  - Snyk Code: Static code analysis
  - Snyk Open Source: Dependency vulnerabilities
- **Setup:** Requires `SNYK_TOKEN` secret
- **Reports:** GitHub Security tab + Snyk dashboard

### Trivy
- **What:** Scans Docker images for vulnerabilities
- **Coverage:** OS packages, application dependencies
- **Setup:** None required
- **Reports:** GitHub Security tab

### Grype
- **What:** Alternative container scanner (broader coverage)
- **Coverage:** Vulnerabilities in container images
- **Setup:** None required
- **Reports:** Job logs

### OWASP Dependency Check
- **What:** Identifies known vulnerabilities in dependencies
- **Coverage:** npm packages
- **Setup:** None required
- **Reports:** Downloadable artifact in workflow run

### TruffleHog
- **What:** Scans git history for secrets
- **Coverage:** API keys, tokens, credentials in commits
- **Setup:** None required
- **Reports:** Job logs

### Gitleaks
- **What:** Another secret scanner (complementary to TruffleHog)
- **Coverage:** Secrets in code and commits
- **Setup:** None required
- **Reports:** Job summary

---

## Viewing Security Results

### GitHub Security Tab
1. Go to your repository on GitHub
2. Click **Security** tab
3. View **Code scanning alerts** for CodeQL, Snyk, and Trivy findings

### Workflow Artifacts
Some tools generate downloadable reports:
- **OWASP Dependency Check:** HTML report in workflow artifacts
- **License Report:** JSON file in workflow artifacts

---

## Disabling Security Tools

If you want to disable specific security tools, edit `.github/workflows/security.yml`:

### Disable Snyk Only
Comment out or remove the `snyk` job:

```yaml
# snyk:
#   name: Snyk Security Scan
#   ...
```

### Disable All Security Scans
Delete or disable the workflow:
```bash
# Disable by renaming
mv .github/workflows/security.yml .github/workflows/security.yml.disabled
```

### Disable for Specific Branches
Modify the workflow trigger:

```yaml
on:
  push:
    branches: [main]  # Only run on main, not develop
```

---

## Security Scan Schedule

The security workflow runs:
- **Daily at 2 AM UTC** (scheduled scan)
- **On every push** to `main` or `develop`
- **On pull requests** to `main`
- **Manually** via workflow dispatch

---

## Troubleshooting

### Snyk: "Path does not exist: snyk-code.sarif"

**Cause:** Missing `SNYK_TOKEN` secret

**Fix:** Add the token as described in the Quick Setup section above

### Container Scans Fail

**Cause:** Docker build errors

**Fix:**
1. Test Docker builds locally: `docker build -f apps/vtt/docker/backend.Dockerfile apps/vtt`
2. Check the workflow logs for build errors
3. Fix any Dockerfile issues

### License Check Fails

**Cause:** New dependency with incompatible license

**Fix:**
1. Check workflow logs for the offending package
2. Either remove the package or update the allowed licenses list in `security.yml` line 206

---

## Best Practices

1. **Review alerts regularly** - Check the Security tab weekly
2. **Fix high/critical vulnerabilities** - Prioritize severe issues
3. **Keep dependencies updated** - Run `npm audit` and `npm update` regularly
4. **Don't commit secrets** - Use environment variables and `.gitignore`
5. **Enable Dependabot** - GitHub → Settings → Security → Enable Dependabot alerts

---

## Need Help?

- 🔒 [GitHub Security Features](https://docs.github.com/en/code-security)
- 🐍 [Snyk Documentation](https://docs.snyk.io)
- 🔍 [CodeQL Documentation](https://codeql.github.com/docs/)
