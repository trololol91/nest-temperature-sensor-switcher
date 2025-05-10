import eslint from '@eslint/js';
import jestPlugin from 'eslint-plugin-jest';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      jest: jestPlugin,
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
    }
  }
);

// export default tseslint.config({
//   env: {
//     browser: false,
//     es6: true,
//     node: true
//   },
//   parser: "@typescript-eslint/parser",
//   parserOptions: {
//     project: "tsconfig.json",
//     sourceType: "module",
//     ecmaVersion: 2020
//   },
//   plugins: ["@typescript-eslint", "jest"],
//   extends: [
//     "eslint:recommended",
//     "plugin:@typescript-eslint/recommended",
//     "plugin:jest/recommended",
//     "prettier"
//   ],
//   rules: {
//     "@typescript-eslint/no-empty-function": [0],
//     "@typescript-eslint/explicit-function-return-type": 0,
//     "@typescript-eslint/semi": ["error", "always"],
//     "@typescript-eslint/no-floating-promises": "error"
//   }
// });

