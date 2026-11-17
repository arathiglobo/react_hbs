import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import axiosInstance from "../../components/AxiosInstance";
import AllRegistrations, { compareLatestFirst } from "./AllRegistrations";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

describe("compareLatestFirst", () => {
  it("puts the newest registration first and undated rows last", () => {
    const rows = [
      { id: 1, companyName: "AA", registeredAt: "2026-01-05T10:00:00" },
      { id: 9, companyName: "Old", registeredAt: null },
      { id: 2, companyName: "ZZ", registeredAt: "2026-11-16T17:42:33.135059" },
      { id: 12, companyName: "Older", registeredAt: null },
      { id: 3, companyName: "MM", registeredAt: [2026, 6, 1, 9, 30, 0] },
    ];
    expect(rows.sort(compareLatestFirst).map((r) => r.companyName)).toEqual([
      "ZZ",
      "MM",
      "AA",
      "Older",
      "Old",
    ]);
  });
});

describe("AllRegistrations", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("lists the latest registration on top across types, not by name", async () => {
    axiosInstance.get.mockImplementation((url) => {
      const byUrl = {
        "/api/agent": [
          { id: 1, companyName: "AA Travels", registeredDate: "2026-03-01T10:00:00" },
        ],
        "/api/hotels": [
          { hotelId: 5, hotelName: "Zeta Hotel", createdDate: "2026-11-16T09:00:00.123456" },
        ],
        "/api/cabProvider": [
          { cabprovider: 7, providername: "Mid Cabs", createdDate: "2026-07-10T12:00:00" },
        ],
      };
      return Promise.resolve({ data: byUrl[url] || [] });
    });

    await act(async () => {
      root.render(<AllRegistrations />);
    });

    const names = Array.from(container.querySelectorAll("tbody tr")).map(
      (tr) => tr.querySelectorAll("td")[2]?.textContent,
    );
    expect(names).toEqual(["Zeta Hotel", "Mid Cabs", "AA Travels"]);
  });

  it("Agency Name header cycles A–Z, Z–A and back to latest first", async () => {
    axiosInstance.get.mockImplementation((url) => {
      const byUrl = {
        "/api/agent": [
          { id: 1, companyName: "AG10", registeredDate: "2026-03-01T10:00:00" },
          { id: 2, companyName: "ag2", registeredDate: "2026-02-01T10:00:00" },
        ],
        "/api/hotels": [
          { hotelId: 5, hotelName: "Zeta Hotel", createdDate: "2026-11-16T09:00:00" },
          { hotelId: 6, hotelName: "", createdDate: "2026-11-17T09:00:00" },
        ],
      };
      return Promise.resolve({ data: byUrl[url] || [] });
    });

    await act(async () => {
      root.render(<AllRegistrations />);
    });

    const names = () =>
      Array.from(container.querySelectorAll("tbody tr")).map(
        (tr) => tr.querySelectorAll("td")[2]?.textContent,
      );
    const header = () => container.querySelector("th[aria-sort]");
    const click = () =>
      act(() => {
        header().querySelector("button").click();
      });

    expect(header().getAttribute("aria-sort")).toBe("none");
    expect(names()).toEqual(["-", "Zeta Hotel", "AG10", "ag2"]);

    click();
    expect(header().getAttribute("aria-sort")).toBe("ascending");
    expect(names()).toEqual(["ag2", "AG10", "Zeta Hotel", "-"]);

    click();
    expect(header().getAttribute("aria-sort")).toBe("descending");
    expect(names()).toEqual(["Zeta Hotel", "AG10", "ag2", "-"]);

    click();
    expect(header().getAttribute("aria-sort")).toBe("none");
    expect(names()).toEqual(["-", "Zeta Hotel", "AG10", "ag2"]);
  });
});
