import { landingEnterHref, shouldLandOnHome } from "@/services/sessionRestore";

describe("shouldLandOnHome", () => {
  it("lands on home right after logging in", () => {
    expect(shouldLandOnHome({ wasInside: false, isInside: true, entryPath: "/ingresar" })).toBe(
      true,
    );
  });

  it("lands on home when a restored session started on the landing", () => {
    expect(shouldLandOnHome({ wasInside: null, isInside: true, entryPath: "/" })).toBe(true);
  });

  it("lands on home on a native cold start with no known path", () => {
    expect(shouldLandOnHome({ wasInside: null, isInside: true, entryPath: null })).toBe(true);
  });

  it("keeps a signed-in visitor on the web landing at /, but still lands native on home", () => {
    expect(shouldLandOnHome({ wasInside: null, isInside: true, entryPath: "/", isWeb: true })).toBe(
      false,
    );
    expect(
      shouldLandOnHome({ wasInside: null, isInside: true, entryPath: "/", isWeb: false }),
    ).toBe(true);
    // Reloading on the sign-in screen still goes into the app, on web too.
    expect(
      shouldLandOnHome({ wasInside: null, isInside: true, entryPath: "/ingresar", isWeb: true }),
    ).toBe(true);
    // A real login lands on home wherever it happened.
    expect(
      shouldLandOnHome({ wasInside: false, isInside: true, entryPath: "/", isWeb: true }),
    ).toBe(true);
  });

  it("keeps an in-app path after a reload", () => {
    expect(shouldLandOnHome({ wasInside: null, isInside: true, entryPath: "/messages" })).toBe(
      false,
    );
    expect(shouldLandOnHome({ wasInside: null, isInside: true, entryPath: "/settings" })).toBe(
      false,
    );
  });

  it("does nothing while signed out or when already inside", () => {
    expect(shouldLandOnHome({ wasInside: null, isInside: false, entryPath: "/" })).toBe(false);
    expect(shouldLandOnHome({ wasInside: true, isInside: true, entryPath: "/" })).toBe(false);
  });
});

describe("landingEnterHref", () => {
  it("leads to the sign-in screen while signed out", () => {
    expect(landingEnterHref({ isLoggedIn: false, hasAcceptedTerms: false })).toBe("/ingresar");
  });

  it("leads straight into the app when signed in, or to the terms when still pending", () => {
    expect(landingEnterHref({ isLoggedIn: true, hasAcceptedTerms: true })).toBe("/home");
    expect(landingEnterHref({ isLoggedIn: true, hasAcceptedTerms: false })).toBe("/terms");
  });
});
