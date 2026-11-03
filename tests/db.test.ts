import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/server/db";
import { resetDb, seedStore } from "./setup-db";

describe("banco de teste", () => {
  beforeEach(resetDb);

  it("cria a loja de teste", async () => {
    await seedStore();
    expect(await db.store.count()).toBe(1);
  });
});
