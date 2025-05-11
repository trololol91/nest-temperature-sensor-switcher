import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      stylistic,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "build/*.ts"],
          defaultProject: "tsconfig.json",
      },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-empty-function": "off",
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-floating-promises": "error",
      'stylistic/semi': ['error', 'always'],
      "no-restricted-imports": ["error", {
        "patterns": [".*"]
      }],
    }
  }
);