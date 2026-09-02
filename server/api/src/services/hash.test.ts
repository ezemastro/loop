/**
 * El hash señuelo tiene que costar exactamente lo mismo que un hash real, o la corrección de
 * timing de D5 regresa en silencio la próxima vez que alguien ajuste `SALT_ROUNDS` (SEC-03,
 * SEC-16).
 */
import bcrypt from "bcrypt";
import { comparePasswords, hashPassword, __getDummyHashForTesting } from "./hash";

const bcryptCostOf = (hash: string): number => {
  // Formato bcrypt: $2b$<cost>$<22-char-salt><31-char-hash>
  const parts = hash.split("$");
  return Number(parts[2]);
};

describe("hash / dummy hash cost parity", () => {
  it("the dummy hash uses the same bcrypt cost factor as a real hash", async () => {
    const realHash = await hashPassword("some-real-password");
    const dummyHash = await __getDummyHashForTesting();
    expect(bcryptCostOf(dummyHash)).toBe(bcryptCostOf(realHash));
  });
});

describe("hash / comparePasswords null-safety", () => {
  it("returns false (never throws) when the hash is null", async () => {
    await expect(comparePasswords("anything", null)).resolves.toBe(false);
  });

  it("still compares correctly against a real hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(comparePasswords("correct-horse-battery-staple", hash)).resolves.toBe(true);
    await expect(comparePasswords("wrong-password", hash)).resolves.toBe(false);
  });

  it("null-hash comparisons run real bcrypt work, not a shortcut", async () => {
    const compareSpy = jest.spyOn(bcrypt, "compare");
    await comparePasswords("anything", null);
    expect(compareSpy).toHaveBeenCalled();
    compareSpy.mockRestore();
  });
});
