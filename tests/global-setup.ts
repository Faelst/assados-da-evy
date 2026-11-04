import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.DATABASE_URL_TEST ?? "postgresql://fael_st@localhost:5432/assados_da_evy_test";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
