import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // .claude holds agent worktrees (full repo copies) — linting them both
  // explodes the file count and breaks typed-parser project resolution.
  // services/* and tools/* are separate packages with their own configs.
  { ignores: ['dist', 'coverage', '.claude', 'services', 'tools'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Newly enforced by the eslint 10 / react-hooks 7.1 upgrade. These flag
      // pre-existing patterns (not regressions from this bump), so they are
      // kept as non-blocking warnings to let the tooling upgrade land clean;
      // the code cleanup is tracked as a separate follow-up PR.
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
)
