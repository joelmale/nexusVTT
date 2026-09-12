#!/usr/bin/env node

/**
 * CSS Layout Validation Script
 *
 * This script validates CSS files to catch layout issues that could cause
 * panels to overflow viewport bounds or toolbars to become invisible.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// CSS patterns that could lead to layout issues
const PROBLEMATIC_PATTERNS = [
  {
    pattern: /^\.layout-panel\s*\{[^}]*(?!.*max-height|.*height.*100)/ms,
    message:
      'layout-panel should have explicit height constraints (max-height or height: 100%)',
    severity: 'error',
  },
  {
    pattern: /\.panel-content[^{]*\{[^}]*overflow-x:\s*visible/,
    message:
      'panel-content with overflow-x: visible can cause scrollbar issues',
    severity: 'warning',
  },
  {
    pattern:
      /\.sidebar-resize-handle[^{]*\{[^}]*height:\s*100%[^}]*(?!.*max-height)/,
    message:
      'sidebar-resize-handle with height: 100% should have max-height constraint',
    severity: 'warning',
  },
];

// Required layout constraints for specific components
const REQUIRED_CONSTRAINTS = [
  {
    selector: '.layout-panel',
    requiredProperties: ['max-height', 'height'],
    message:
      'layout-panel must have height constraints to prevent viewport overflow',
    excludePatterns: [
      /\.theme-\w+\s+\.layout-panel/, // Exclude themed selectors
      /\.layout-panel\.[a-zA-Z-]+/, // Exclude class combinations
      /\.layout-panel\s+\./, // Exclude child selectors
      /\.layout-panel,/, // Exclude when part of selector list
      /,\s*\.layout-panel/, // Exclude when part of selector list
    ],
  },
  {
    selector: '.panel-content',
    requiredProperties: ['overflow-y'],
    message: 'panel-content should specify overflow behavior',
  },
  {
    selector: '.settings-content',
    requiredProperties: ['overflow-y', 'flex'],
    message: 'settings-content should be scrollable and flexible',
  },
];

function validateCSSFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Check for problematic patterns
  PROBLEMATIC_PATTERNS.forEach(({ pattern, message, severity }) => {
    const matches = content.match(pattern);
    if (matches) {
      issues.push({
        file: filePath,
        type: 'pattern',
        severity,
        message,
        line: getLineNumber(content, matches.index || 0),
      });
    }
  });

  // Check for required constraints
  REQUIRED_CONSTRAINTS.forEach(
    ({ selector, requiredProperties, message, excludePatterns = [] }) => {
      const selectorRegex = new RegExp(`\\${selector}[^{]*\\{([^}]*)\\}`, 'g');
      const matches = [...content.matchAll(selectorRegex)];

      matches.forEach((match) => {
        const fullMatch = match[0];
        const ruleContent = match[1];

        // Check if this match should be excluded
        const shouldExclude = excludePatterns.some((pattern) =>
          pattern.test(fullMatch),
        );
        if (shouldExclude) return;

        const hasRequired = requiredProperties.some((prop) =>
          new RegExp(`${prop}\\s*:`).test(ruleContent),
        );

        if (!hasRequired) {
          issues.push({
            file: filePath,
            type: 'missing-constraint',
            severity: 'error',
            message: `${selector}: ${message}`,
            line: getLineNumber(content, match.index || 0),
          });
        }
      });
    },
  );

  return issues;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function validateLayoutCSS() {
  const cssFiles = glob.sync('src/**/*.css', { cwd: process.cwd() });
  let totalIssues = 0;
  let errorCount = 0;

  console.log('🔍 Validating CSS layout constraints...\n');

  cssFiles.forEach((file) => {
    const issues = validateCSSFile(file);

    if (issues.length > 0) {
      console.log(`📄 ${file}:`);

      issues.forEach((issue) => {
        const icon =
          issue.severity === 'error'
            ? '❌'
            : issue.severity === 'warning'
              ? '⚠️'
              : 'ℹ️';

        console.log(`  ${icon} Line ${issue.line}: ${issue.message}`);

        if (issue.severity === 'error') {
          errorCount++;
        }
        totalIssues++;
      });

      console.log('');
    }
  });

  // Summary
  if (totalIssues === 0) {
    console.log('✅ No layout constraint issues found!');
  } else {
    console.log(`📊 Found ${totalIssues} layout issues (${errorCount} errors)`);

    if (errorCount > 0) {
      console.log(
        '\n❌ Layout validation failed. Please fix the errors above.',
      );
      process.exit(1);
    } else {
      console.log('\n⚠️ Layout validation passed with warnings.');
    }
  }
}

// Run validation if this script is executed directly
if (import.meta.url.endsWith(path.basename(process.argv[1]))) {
  validateLayoutCSS();
}

export { validateLayoutCSS, validateCSSFile };
