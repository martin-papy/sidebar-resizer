import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Standard browser globals
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        PointerEvent: 'readonly',
        // FoundryVTT globals available at runtime
        game: 'readonly',
        Hooks: 'readonly',
        foundry: 'readonly',
        ui: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/'],
  },
];
