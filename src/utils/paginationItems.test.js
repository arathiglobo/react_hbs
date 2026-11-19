import { getPaginationItems } from "./paginationItems";

const show = (total, current) =>
  getPaginationItems(total, current)
    .map((item) => (typeof item === "string" ? "..." : item))
    .join(" ");

describe("getPaginationItems", () => {
  it("shows first 3 and last 3 pages", () => {
    expect(show(24, 1)).toBe("1 2 3 ... 22 23 24");
    expect(show(24, 24)).toBe("1 2 3 ... 22 23 24");
  });

  it("keeps the current page and its neighbours visible", () => {
    expect(show(24, 10)).toBe("1 2 3 ... 9 10 11 ... 22 23 24");
    expect(show(24, 21)).toBe("1 2 3 ... 20 21 22 23 24");
  });

  it("fills a one-page gap instead of showing an ellipsis", () => {
    expect(show(24, 5)).toBe("1 2 3 4 5 6 ... 22 23 24");
    expect(show(7, 1)).toBe("1 2 3 4 5 6 7");
  });

  it("handles small and empty page counts", () => {
    expect(show(0, 1)).toBe("");
    expect(show(1, 1)).toBe("1");
    expect(show(8, 1)).toBe("1 2 3 ... 6 7 8");
  });

  it("uses unique keys for ellipses", () => {
    const keys = getPaginationItems(24, 10).filter((i) => typeof i === "string");
    expect(new Set(keys).size).toBe(keys.length);
  });
});
