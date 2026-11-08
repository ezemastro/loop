import { formatDateLabel } from "../components/bases/DateBadge";

describe("formatDateLabel", () => {
  const now = new Date(2026, 10, 7);

  it("omits the year within the current year", () => {
    expect(formatDateLabel(new Date(2026, 10, 5), now)).toBe("jue 5 de noviembre");
  });

  it("adds the year for another year", () => {
    expect(formatDateLabel(new Date(2025, 11, 31), now)).toBe("mié 31 de diciembre de 2025");
  });
});
