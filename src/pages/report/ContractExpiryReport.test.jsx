import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import axiosInstance from "../../components/AxiosInstance";
import ContractExpiryReport from "./ContractExpiryReport";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/BackButton", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/Hotelfilters", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/Supplier", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/DestinationCity", () => ({ __esModule: true, default: () => null }));
jest.mock("jspdf", () => jest.fn());
jest.mock("jspdf-autotable", () => jest.fn());
jest.mock("react-hot-toast", () => {
  const toast = { error: jest.fn(), success: jest.fn() };
  return { __esModule: true, toast, default: toast };
});

const CONTRACTS = Array.from({ length: 240 }, (_, i) => ({
  rateCode: `RATE${i + 1}`,
  hotelName: "Test Hotel",
  hotelType: "Hotel",
  expirationDate: "2026-12-31",
}));

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const pageButtons = (root) =>
  Array.from(root.querySelectorAll(".pagination li"))
    .slice(1, -1) // drop Prev / Next
    .map((li) => (li.textContent.includes("…") ? "..." : li.textContent.replace(/\(current\)/, "").trim()));
const clickPage = (root, label) =>
  act(async () =>
    Array.from(root.querySelectorAll(".pagination .page-link"))
      .find((el) => el.textContent.replace(/\(current\)/, "").trim() === label)
      .click()
  );

describe("ContractExpiryReport status", () => {
  let container;
  let root;

  const contract = (rateCode, status, expirationDate) => ({
    rateCode, status, expirationDate, hotelName: "Test Hotel", day: "All Days",
  });

  beforeEach(async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const rows = [
      contract("PEAK2026", "Stop", "2999-12-31"), // switched off: Stop, even though still valid
      contract("OLD2025", "Live", "2000-12-31"), // live but past its date: Expired
      contract("STOPOLD", "Stop", "2000-01-01"), // switched off and past its date: Stop
      contract("TODAY", "Live", today), // expires today: still Live
      contract("3000", "Live", "2999-11-28"),
      contract("NODATE", "Live", null),
    ];
    axiosInstance.get.mockImplementation((url) =>
      Promise.resolve({ data: url === "/api/report/contractrates" ? rows : [] })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ContractExpiryReport />));
    await flush();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("shows the contract's own Stop, and Expired for live contracts past their date", () => {
    const statuses = Object.fromEntries(
      Array.from(container.querySelectorAll("tbody tr")).map((tr) => [
        tr.children[1].textContent.trim(),
        tr.children[4].textContent.trim(),
      ])
    );
    expect(statuses).toEqual({
      PEAK2026: "Stop",
      OLD2025: "Expired",
      STOPOLD: "Stop",
      TODAY: "Live",
      3000: "Live",
      NODATE: "Live",
    });
  });
});

describe("ContractExpiryReport pagination", () => {
  let container;
  let root;

  beforeEach(async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    axiosInstance.get.mockImplementation((url) =>
      Promise.resolve({ data: url === "/api/report/contractrates" ? CONTRACTS : [] })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ContractExpiryReport />));
    await flush();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("puts the table search on the left and Search / Reset before Mail", () => {
    const search = container.querySelector('input[placeholder="search here"]');
    const row = search.closest(".row");
    const buttons = Array.from(row.querySelectorAll("button")).map((b) => b.textContent.trim());

    expect(buttons).toEqual(["Search", "Reset", "Mail", "Print", "PDF", "Excel"]);
    // search box comes first in the row, before the buttons
    expect(row.querySelector("input, button")).toBe(search);
    expect(container.querySelectorAll('input[placeholder="search here"]')).toHaveLength(1);
  });

  it("the moved search box still filters the table", async () => {
    const search = container.querySelector('input[placeholder="search here"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(search, "RATE24");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const codes = Array.from(container.querySelectorAll("tbody tr")).map((tr) => tr.children[1].textContent.trim());
    expect(codes).toEqual(["RATE24", "RATE240"]);
  });

  it("shows first 3 and last 3 page numbers", () => {
    expect(pageButtons(container)).toEqual(["1", "2", "3", "...", "22", "23", "24"]);
  });

  it("keeps the current page and its neighbours visible", async () => {
    await clickPage(container, "3");
    await clickPage(container, "4");
    await clickPage(container, "5");
    await clickPage(container, "6");
    expect(pageButtons(container)).toEqual(["1", "2", "3", "4", "5", "6", "7", "...", "22", "23", "24"]);
    expect(container.querySelector(".pagination .active").textContent).toContain("6");
  });
});
