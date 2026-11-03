import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { signSession, readSession, verifyCredentials, can } from "@/server/session";
import { resetDb, seedStore } from "../setup-db";

describe("sessão do admin", () => {
  it("assina e lê a sessão", async () => {
    const token = await signSession({ userId: "u1", storeId: "s1", role: "OWNER", name: "Evy" });
    expect(await readSession(token)).toMatchObject({ userId: "u1", storeId: "s1", role: "OWNER", name: "Evy" });
  });

  it("token adulterado é recusado", async () => {
    const token = await signSession({ userId: "u1", storeId: "s1", role: "KITCHEN", name: "Evy" });
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "u1", storeId: "s1", role: "OWNER", name: "Evy" })).toString("base64url");
    expect(await readSession(`${h}.${forged}.${s}`)).toBeNull();
    expect(await readSession("lixo")).toBeNull();
  });

  describe("credenciais", () => {
    beforeEach(async () => {
      await resetDb();
      const store = await seedStore();
      await db.user.create({
        data: { storeId: store.id, name: "Evy", email: "evy@x.com", passwordHash: await bcrypt.hash("segredo1", 4), role: "OWNER" },
      });
    });
    it("senha certa entra, errada não", async () => {
      expect(await verifyCredentials("EVY@x.com ", "segredo1")).toMatchObject({ name: "Evy", role: "OWNER" });
      expect(await verifyCredentials("evy@x.com", "errada")).toBeNull();
      expect(await verifyCredentials("ninguem@x.com", "segredo1")).toBeNull();
    });
  });

  it("permissões por papel", () => {
    expect(can("KITCHEN", "agenda")).toBe(true);
    expect(can("KITCHEN", "pedidos")).toBe(true);
    expect(can("KITCHEN", "receitas")).toBe(false);
    expect(can("ATTENDANT", "cardapio-do-dia")).toBe(true);
    expect(can("ATTENDANT", "configuracoes")).toBe(false);
    expect(can("OWNER", "configuracoes")).toBe(true);
  });
});
