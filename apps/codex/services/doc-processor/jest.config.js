module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Ratchet: set just under measured coverage so the gate fails on a
  // REGRESSION rather than describing an aspiration. Raise these whenever
  // real coverage rises; never lower them without a reason.
  //
  // Measured 2026-09-17: statements 44.2, branches 44.3, functions 39.3,
  // lines 44.1 (10 suites, 43 tests).
  //
  // Jest's key really is `global` (unlike Vitest, which has no such key).
  // Only enforced on a run that collects coverage -- `npm run test:coverage`,
  // not the bare `npm test` that CI currently runs.
  coverageThreshold: {
    global: {
      statements: 43,
      branches: 43,
      functions: 38,
      lines: 43,
    },
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
};
