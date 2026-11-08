import { shouldLandOnHome } from "@/services/sessionRestore";

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
