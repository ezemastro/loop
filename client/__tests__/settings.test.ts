import fs from "fs";
import path from "path";
import { canConfirmAccountDeletion } from "../services/accountDeletion";
import { SETTINGS_GROUPS } from "../components/settings/settingsItems";
import { PRIMARY_TABS } from "../components/header/primaryTabs";
import type { SupportMailTemplate } from "../services/supportMail";

/**
 * Table integrity for `SETTINGS_GROUPS` (design.md D3), the account-deletion confirmation gate
 * (design.md D2), and the source guards proving the relocation and nav isolation actually
 * happened (design.md "Testing Strategy").
 */

const CLIENT_ROOT = path.join(__dirname, "..");

describe("canConfirmAccountDeletion", () => {
  const accountEmail = "alguien@colegio.edu";

  it("exact match while not deleting enables confirmation", () => {
    expect(canConfirmAccountDeletion(accountEmail, accountEmail, false)).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["a different address", "otro@colegio.edu"],
    ["a differently-cased variant", accountEmail.toUpperCase()],
    ["the same address with surrounding whitespace", ` ${accountEmail} `],
  ])("%s keeps confirmation disabled", (_label, typed) => {
    expect(canConfirmAccountDeletion(typed, accountEmail, false)).toBe(false);
  });

  it("an in-flight deletion keeps confirmation disabled even with an exact match", () => {
    expect(canConfirmAccountDeletion(accountEmail, accountEmail, true)).toBe(false);
  });

  it("an empty account email never matches, even against an empty typed value", () => {
    expect(canConfirmAccountDeletion("", "", false)).toBe(false);
  });
});

describe("SETTINGS_GROUPS", () => {
  // Grew to three with `legal-public-routes` task 6.3 (in-app links to the legal pages).
  it("has exactly three groups: account, legal and contact", () => {
    expect(SETTINGS_GROUPS).toHaveLength(3);
    expect(SETTINGS_GROUPS.map((group) => group.key)).toEqual(["account", "legal", "contact"]);
  });

  it("every group has a unique, non-empty key and a non-empty Spanish title", () => {
    const keys = SETTINGS_GROUPS.map((group) => group.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const group of SETTINGS_GROUPS) {
      expect(group.key.length).toBeGreaterThan(0);
      expect(group.title.length).toBeGreaterThan(0);
    }
  });

  it("every item has a unique key across the whole table and a non-empty label and Icon", () => {
    const allItems = SETTINGS_GROUPS.flatMap((group) => group.items);
    const itemKeys = allItems.map((item) => item.key);
    expect(new Set(itemKeys).size).toBe(itemKeys.length);
    for (const item of allItems) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.Icon).toBeDefined();
    }
  });

  it("the legal group links to the public privacy and terms routes", () => {
    const legalGroup = SETTINGS_GROUPS.find((group) => group.key === "legal");
    expect(legalGroup).toBeDefined();
    const hrefs = legalGroup!.items.map((item) => item.action).map((action) => action);
    expect(hrefs).toContainEqual({ kind: "link", href: "/privacidad" });
    expect(hrefs).toContainEqual({ kind: "link", href: "/terminos" });
  });

  it("only the account-deletion row is destructive", () => {
    const allItems = SETTINGS_GROUPS.flatMap((group) => group.items);
    const destructive = allItems.filter((item) => item.variant === "destructive");
    expect(destructive).toHaveLength(1);
    expect(destructive[0].action).toEqual({ kind: "deleteAccount" });
  });

  it("every mail action carries a valid SupportMailTemplate", () => {
    const allItems = SETTINGS_GROUPS.flatMap((group) => group.items);
    const mailActions = allItems
      .map((item) => item.action)
      .filter(
        (action): action is { kind: "mail"; template: SupportMailTemplate } =>
          action.kind === "mail",
      );
    expect(mailActions.length).toBeGreaterThan(0);
    for (const action of mailActions) {
      expect(["bug", "suggestion", "contact"]).toContain(action.template);
    }
  });
});

describe("Source guard: relocated session and account actions", () => {
  const content = fs.readFileSync(path.join(CLIENT_ROOT, "components/UserPage.tsx"), "utf8");

  it.each(["Cerrar sesión", "Eliminar cuenta", "useDeleteAccount", "CustomModal"])(
    "UserPage.tsx no longer contains %s",
    (token) => {
      expect(content).not.toContain(token);
    },
  );
});

describe("Source guard: nav isolation", () => {
  it("PRIMARY_TABS still has exactly the five original keys and none is settings", () => {
    expect(PRIMARY_TABS.map((tab) => tab.key)).toEqual([
      "home",
      "myListings",
      "publish",
      "wishlist",
      "profile",
    ]);
  });

  it("(tabs)/_layout.tsx registers no settings screen", () => {
    const content = fs.readFileSync(
      path.join(CLIENT_ROOT, "app/(main)/(tabs)/_layout.tsx"),
      "utf8",
    );
    expect(content).not.toMatch(/name="settings"/);
  });
});
