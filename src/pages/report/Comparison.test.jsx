import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import Comparison from "./Comparison";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/BackButton", () => ({ __esModule: true, default: () => null }));
jest.mock("jspdf", () => jest.fn());
jest.mock("jspdf-autotable", () => jest.fn());
jest.mock("react-hot-toast", () => {
  const toast = { error: jest.fn(), success: jest.fn() };
  return { __esModule: true, toast, default: toast };
});

const AGENTS = [
  { id: 10, companyName: "Globo_Melvin " },
  { id: 11, companyName: "Globo" },
  { id: 12, companyName: "", firstName: "Subin", lastName: "Suresh" },
];
const HOTELS = [{ id: 1, hotelName: "Grand Hotel" }, { id: 2, hotelName: "Atlantis" }];
const AGENT_ROWS = [
  { agentName: "Globo_Melvin", noOfBooking: 7, cancelledBooking: 2 },
  { agentName: "Unknown", noOfBooking: 3, cancelledBooking: 0 },
];
const HOTEL_ROWS = [{ hotelName: "grand hotel", noOfBooking: 4, cancelledBooking: 1 }];

const fakeGet = (url) => {
  const data = {
    "/api/agent": AGENTS,
    "/api/hotels": HOTELS,
    "/api/reports/agent-summary": AGENT_ROWS,
    "/api/reports/hotel-summary": HOTEL_ROWS,
  }[url];
  return Promise.resolve({ data: data || [] });
};

const type = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const click = (el) => act(async () => el.click());
const radio = (root, label) =>
  Array.from(root.querySelectorAll(".form-check"))
    .find((fc) => fc.textContent.trim() === label)
    .querySelector("input");
const button = (text) =>
  Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent.trim() === text);
const menuItem = (text) =>
  Array.from(document.body.querySelectorAll(".dropdown-menu.show .dropdown-item")).find((el) => el.textContent.trim() === text);
const menuItems = () =>
  Array.from(document.body.querySelectorAll(".dropdown-menu.show .dropdown-item")).map((el) => el.textContent.trim());
const tableRows = (root) =>
  Array.from(root.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.children).map((td) => td.textContent.trim()).join(" | ")
  );

describe("Comparison report", () => {
  let container;
  let root;

  beforeEach(async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    window.alert = jest.fn();
    axiosInstance.get.mockImplementation(fakeGet);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Comparison />));
    await flush();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const pickAgentAndOther = async (agent, other) => {
    await click(radio(container, "Agent"));
    await click(button("Select Agent Criteria"));
    await click(menuItem(agent));
    await click(radio(container, "Other"));
    await click(button("Select Agent to Compare"));
    await click(menuItem(other));
  };

  it("does not call the report API before Search", () => {
    const urls = axiosInstance.get.mock.calls.map(([url]) => url);
    expect(urls).not.toContain("/api/reports/hotel-summary");
    expect(urls).not.toContain("/api/reports/agent-summary");
  });

  it("compares two agents using the agent summary", async () => {
    await pickAgentAndOther("Globo_Melvin", "Globo");
    await click(button("Search"));
    await flush();

    expect(axiosInstance.get).toHaveBeenCalledWith("/api/reports/agent-summary", { params: {} });
    expect(tableRows(container)).toEqual([
      "1 | Globo_Melvin | 7 | 2",
      "2 | Globo | 0 | 0", // no bookings -> still listed with zeros
    ]);
    expect(container.textContent).toContain("Agent Name");
  });

  it("mails the compared agents with a type the server accepts", async () => {
    axiosInstance.post.mockResolvedValue({ data: { message: "Report sent successfully", recordCount: 2 } });
    await pickAgentAndOther("Globo_Melvin", "Globo");
    await click(button("Search"));
    await flush();

    await click(button("Mail"));
    await act(async () => type(document.body.querySelector('.modal input[type="email"]'), " ops@example.com "));
    await click(button("Send Email"));
    await flush();

    expect(axiosInstance.post).toHaveBeenCalledWith("/api/reports/send-email", {
      email: "ops@example.com",
      reportType: "comparison",
      subType: "agent",
      filters: {
        selectedOption: "agent",
        selectedAgentHotel: "Globo_Melvin",
        compareOption: "other",
        selectedOtherEntity: "Globo",
      },
    });
    expect(toast.success).toHaveBeenCalledWith("Report sent successfully (2 records)");
  });

  it("names agents without a company by first and last name, and hides the selected one from Compare", async () => {
    await click(radio(container, "Agent"));
    await click(button("Select Agent Criteria"));
    expect(menuItems()).toEqual(["Globo", "Globo_Melvin", "Subin Suresh"]);
    await click(menuItem("Globo"));
    await click(radio(container, "Other"));
    await click(button("Select Agent to Compare"));
    expect(menuItems()).toEqual(["Globo_Melvin", "Subin Suresh"]);
  });

  it("uses the hotel summary for hotels and matches names regardless of case", async () => {
    await click(radio(container, "Hotel"));
    await click(button("Select Hotel Criteria"));
    await click(menuItem("Grand Hotel"));
    await click(radio(container, "Date"));
    const [from, to] = container.querySelectorAll('input[type="date"]');
    await act(async () => type(from, "2026-07-01"));
    await act(async () => type(to, "2026-07-31"));
    await click(button("Search"));
    await flush();

    expect(axiosInstance.get).toHaveBeenCalledWith("/api/reports/hotel-summary", {
      params: { fromDate: "2026-07-01", toDate: "2026-07-31" },
    });
    expect(tableRows(container)).toEqual(["1 | grand hotel | 4 | 1"]);
    expect(container.textContent).toContain("Hotel Name");
  });

  it("rejects a From date after the To date", async () => {
    await click(radio(container, "Agent"));
    await click(button("Select Agent Criteria"));
    await click(menuItem("Globo"));
    await click(radio(container, "Date"));
    const [from, to] = container.querySelectorAll('input[type="date"]');
    await act(async () => type(from, "2026-08-01"));
    await act(async () => type(to, "2026-07-30"));
    axiosInstance.get.mockClear();
    await click(button("Search"));

    expect(window.alert).toHaveBeenCalledWith("From Date must be on or before To Date");
    expect(axiosInstance.get).not.toHaveBeenCalled();
  });

  it("shows an error and no stale table when the server fails", async () => {
    axiosInstance.get.mockImplementation((url) =>
      url.startsWith("/api/reports/") ? Promise.reject(new Error("500")) : fakeGet(url)
    );
    jest.spyOn(console, "error").mockImplementation(() => {});
    await pickAgentAndOther("Globo_Melvin", "Globo");
    await click(button("Search"));
    await flush();

    expect(toast.error).toHaveBeenCalledWith("Failed to load comparison data");
    expect(container.querySelector("tbody")).toBeNull();
    console.error.mockRestore();
  });
});
