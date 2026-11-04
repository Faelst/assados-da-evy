import { defineConfig } from "vitest/config";
import path from "node:path";

const TEST_DB = process.env.DATABASE_URL_TEST ?? "postgresql://fael_st@localhost:5432/assados_da_evy_test";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: ["tests/global-setup.ts"],
    env: { DATABASE_URL: TEST_DB, AUTH_SECRET: "test-secret-test-secret-test-secret-123" },
    testTimeout: 20000,
  },
});
