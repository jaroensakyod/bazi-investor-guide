/**
 * ESLint flat config (v9) — โปรเจคใช้ TypeScript + vitest
 * โครงสร้าง: src/ (โค้ดหลัก), scripts/ (pipeline), tests/ (vitest)
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "out/**",
      "output/**",
      "tmp/**",
      "data/**",
      "public/**",
      "scripts/.tmp-*.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // อนุญาต unused args ที่ขึ้นต้นด้วย _ (callback params)
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // console.log ใช้ได้ใน scripts (pipeline) — ปิดเฉพาะไฟล์ src
      "no-console": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: { "no-console": "warn" },
  },
);
