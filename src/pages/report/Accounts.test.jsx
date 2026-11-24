import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Accounts, { findInvertedRange } from "./Accounts";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/BackButton", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/Agent", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/Supplier", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/DestinationCity", () => ({ __esModule: true, default: () => null }));
jest.mock("jspdf", () => jest.fn());
jest.mock("jspdf-autotable", () => jest.fn());
jest.mock("react-hot-toast", () => {
  const toast = { error: jest.fn(), success: jest.fn() };
  return { __esModule: true, toast, default: toast };
});

const payment = (id, date, companyName = `Company ${id}`) => ({
  paymentId: id, agentId: 10, companyName, paymentDate: date,
  creditLimit: 10000, amountPaid: 100, paymentMode: "CASH", remarks: null,
});

const type = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const inputFor = (root, label) =>
  Array.from(root.querySelectorAll("label"))
    .find((l) => l.textContent.trim() === label)
    .parentElement.querySelector("input");
const buttonByText = (root, text) =>
  Array.from(root.querySelectorAll("button")).find((b) => b.textContent.trim() === text);
const companies = (root) =>
  Array.from(root.querySelectorAll("tbody tr")).map((tr) => tr.children[1]?.textContent.trim());
const pageButtons = (root) =>
  Array.from(root.querySelectorAll(".pagination li"))
    .slice(1, -1) // drop Prev / Next
    .map((li) => (li.textContent.includes("…") ? "..." : li.textContent.replace(/\(current\)/, "").trim()));

describe("findInvertedRange", () => {
  it("flags a From date after its To date", () => {
    expect(findInvertedRange({ fromDate: "2026-08-01", toDate: "2026-07-30" })).toBe("Payment Date");
    expect(findInvertedRange({ cancelDateFrom: "2026-02-02", cancelDateTo: "2026-02-01" })).toBe("Cancel Date");
  });

  it("accepts open, same-day and ordered ranges", () => {
    expect(findInvertedRange({ fromDate: "2026-07-28", toDate: "2026-07-28" })).toBeUndefined();
    expect(findInvertedRange({ fromDate: "2026-07-01", toDate: "2026-07-30" })).toBeUndefined();
    expect(findInvertedRange({ fromDate: "2026-08-01", toDate: "" })).toBeUndefined();
  });
});

describe("Accounts report", () => {
  let container;
  let root;
  let rows;

  const render = async () => {
    axiosInstance.get.mockImplementation((url) =>
      Promise.resolve({ data: url === "/api/report/accounts" ? rows : [] })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Accounts />));
    await flush();
  };

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    rows = [payment(11, "2026-07-28T12:35:40", "Test1214"), payment(12, "2026-06-02T09:00:00", "Other Co")];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("does not search an inverted payment date range and says why", async () => {
    await render();
    await act(async () => type(inputFor(container, "From Date"), "2026-08-01"));
    await act(async () => type(inputFor(container, "To Date"), "2026-07-30"));
    axiosInstance.get.mockClear();

    await act(async () => buttonByText(container, "Search").click());

    expect(toast.error).toHaveBeenCalledWith("Payment Date: From Date must be on or before To Date");
    expect(axiosInstance.get).not.toHaveBeenCalledWith("/api/report/accounts", expect.anything());
  });

  it("sends a valid payment date range to the server", async () => {
    await render();
    await act(async () => type(inputFor(container, "From Date"), "2026-07-28"));
    await act(async () => type(inputFor(container, "To Date"), "2026-07-30"));

    await act(async () => buttonByText(container, "Search").click());

    expect(toast.error).not.toHaveBeenCalled();
    expect(axiosInstance.get).toHaveBeenCalledWith("/api/report/accounts", {
      params: { fromDate: "2026-07-28", toDate: "2026-07-30" },
    });
  });

  it("limits the date pickers so the range cannot be inverted", async () => {
    await render();
    await act(async () => type(inputFor(container, "From Date"), "2026-07-28"));
    await act(async () => type(inputFor(container, "To Date"), "2026-07-30"));

    expect(inputFor(container, "From Date").max).toBe("2026-07-30");
    expect(inputFor(container, "To Date").min).toBe("2026-07-28");
  });

  it.each(["28-07-2026", "28/07/2026", "2026-07-28"])(
    "finds a payment by date typed as %s in the search box",
    async (query) => {
      await render();
      const box = container.querySelector('input[placeholder="search here"]');
      await act(async () => type(box, query));
      expect(companies(container)).toEqual(["Test1214"]);
    }
  );

  it("shows first 3 and last 3 page numbers", async () => {
    rows = Array.from({ length: 240 }, (_, i) => payment(i + 1, "2026-07-01T10:00:00"));
    await render();
    expect(pageButtons(container)).toEqual(["1", "2", "3", "...", "22", "23", "24"]);
    expect(container.textContent).toContain("Showing 1 to 10 of 240 entries");
  });
});
