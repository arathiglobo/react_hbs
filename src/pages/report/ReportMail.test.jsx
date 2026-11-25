import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import CancellationReport from "./CancellationReport";
import Accounts from "./Accounts";
import HotelWise from "./HotelWise";
import DayWise from "./DayWise";
import MonthlyWise from "./MonthlyWise";
import AgentWise from "./AgentWise";
import BookingReport from "./BookingReport";
import ContractExpiryReport from "./ContractExpiryReport";

// A filter dropdown stand-in: a button that picks `value` (and `option`, like Country / Place do).
// A function declaration, so the hoisted jest.mock factories can use it.
function mockPicker(label, value, option) {
  const ReactLib = require("react");
  return {
    __esModule: true,
    default: ({ onChange }) =>
      ReactLib.createElement("button", { type: "button", onClick: () => onChange(value, option) }, `pick ${label}`),
  };
}
function mockNothing() {
  return { __esModule: true, default: () => null };
}

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => mockNothing());
jest.mock("../../components/TopBar", () => mockNothing());
jest.mock("../../components/BackButton", () => mockNothing());
jest.mock("../../components/filters/Supplier", () => mockNothing());
jest.mock("../../components/filters/DestinationCity", () => mockNothing());
jest.mock("../../components/filters/Agent", () => mockNothing());
jest.mock("../../components/filters/Region", () => mockNothing());
jest.mock("../../components/filters/State", () => mockNothing());
jest.mock("../../components/filters/City", () => mockNothing());
jest.mock("../../components/filters/Hotelfilters", () => mockPicker("hotel", 1));
jest.mock("../../components/filters/HotelTypefilters", () => mockPicker("hotel type", 3));
jest.mock("../../components/filters/HotelCategory", () => mockPicker("category", 2));
jest.mock("../../components/filters/RoomCategory", () => mockPicker("room", 5));
jest.mock("../../components/filters/MonthFilter", () => mockPicker("month", "April"));
jest.mock("../../components/filters/Country", () => mockPicker("country", 77, { id: 77, name: "India" }));
jest.mock("../../components/filters/place", () => mockPicker("place", 9, { id: 9, name: "Kochi" }));
jest.mock("jspdf", () => jest.fn());
jest.mock("jspdf-autotable", () => jest.fn());
jest.mock("react-hot-toast", () => {
  const toast = { error: jest.fn(), success: jest.fn() };
  return { __esModule: true, toast, default: toast };
});

// Option lists the pages load to turn picked ids into names
const LOOKUPS = {
  "/api/hotels": [{ id: 1, hotelName: "Test Hotel" }],
  "/api/hotelType": [{ hotelTypeId: 3, name: "Resort" }],
  "/api/roomCategory": [{ roomCategoryId: 5, roomCategory: "Junior Suite" }],
};

const type = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const button = (text) =>
  Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent.trim() === text);
const click = async (text) => {
  await act(async () => button(text).click());
  await flush();
};
const input = (placeholder) => document.body.querySelector(`input[placeholder="${placeholder}"]`);
const dateFor = (label) =>
  Array.from(document.body.querySelectorAll("label"))
    .find((l) => l.textContent.trim() === label)
    .parentElement.querySelector('input[type="date"]');
const pickInhouse = async () => {
  const radio = Array.from(document.body.querySelectorAll(".form-check"))
    .find((fc) => fc.textContent.trim() === "Inhouse")
    .querySelector("input");
  await act(async () => radio.click());
};

// Opens Mail, enters the address, sends; returns the request body.
const sendMail = async () => {
  await click("Mail");
  await act(async () => type(document.body.querySelector('.modal input[type="email"]'), " ops@example.com "));
  await click("Send Email");
  expect(axiosInstance.post).toHaveBeenCalledWith("/api/reports/send-email", expect.anything());
  return axiosInstance.post.mock.calls[axiosInstance.post.mock.calls.length - 1][1];
};

describe("report Mail buttons send the filters of the last Search", () => {
  let container;
  let root;

  const render = async (element) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(element));
    await flush();
  };

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    axiosInstance.get.mockImplementation((url) => Promise.resolve({ data: LOOKUPS[url] || [] }));
    axiosInstance.post.mockResolvedValue({ data: { message: "Report sent successfully", recordCount: 2 } });
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("Cancellation: searched filters and search text, not unsaved edits", async () => {
    await render(<CancellationReport />);
    await act(async () => type(input("Booking Reference"), "GLBIN9"));
    await click("Search");
    await act(async () => type(input("Booking Reference"), "edited, not searched"));
    await act(async () => type(input("Search"), "rr"));

    const body = await sendMail();

    expect(body).toEqual({
      email: "ops@example.com",
      reportType: "cancellation",
      filters: { bookingReference: "GLBIN9", searchQuery: "rr" },
    });
    expect(toast.success).toHaveBeenCalledWith("Report sent successfully (2 records)");
  });

  it("shows the server's reason when the mail is refused", async () => {
    axiosInstance.post.mockRejectedValue({ response: { data: { message: "Only staff can email this report." } } });
    await render(<CancellationReport />);

    await sendMail();

    expect(toast.error).toHaveBeenCalledWith("Only staff can email this report.");
  });

  it("Contract Expiry: hotel by name, expiration dates, booking filters and search text", async () => {
    await render(<ContractExpiryReport />);
    await act(async () => type(dateFor("Booking Date"), "2026-04-01"));
    await act(async () => type(dateFor("From Date"), "2026-01-01"));
    await click("pick hotel");
    await click("Search");
    await act(async () => type(input("search here"), "PEAK"));

    const body = await sendMail();

    expect(body).toEqual({
      email: "ops@example.com",
      reportType: "contractexpiry",
      filters: { bookingDateFrom: "2026-04-01", hotelName: "Test Hotel", fromDate: "2026-01-01", searchQuery: "PEAK" },
    });
    expect(toast.success).toHaveBeenCalledWith("Report sent successfully (2 records)");
  });

  it("Accounts: the payment dates of the last Search", async () => {
    await render(<Accounts />);
    await act(async () => type(dateFor("From Date"), "2026-07-01"));
    await act(async () => type(dateFor("To Date"), "2026-07-30"));
    await click("Search");
    await act(async () => type(dateFor("From Date"), "2026-07-15"));
    await act(async () => type(input("search here"), "28-07-2026"));

    const body = await sendMail();

    expect(body.reportType).toBe("accounts");
    expect(body.filters).toEqual({ fromDate: "2026-07-01", toDate: "2026-07-30", searchQuery: "28-07-2026" });
  });

  it("Hotel Wise: column filters by name, as the rows carry names", async () => {
    await render(<HotelWise />);
    await click("pick hotel");
    await click("pick category");
    await click("pick country");
    await click("pick place");
    await act(async () => type(input("Booking Reference"), "GLBIN9"));
    await click("Search");

    const body = await sendMail();

    expect(body.reportType).toBe("hotelwise");
    expect(body.filters).toEqual({
      bookingReference: "GLBIN9",
      hotelName: "Test Hotel",
      hotelCategoryId: 2,
      countryName: "India",
      placeName: "Kochi",
    });
  });

  it("Day Wise opens with Inhouse selected and its filters shown", async () => {
    await render(<DayWise />);

    const inhouse = Array.from(document.body.querySelectorAll(".form-check"))
      .find((fc) => fc.textContent.trim() === "Inhouse")
      .querySelector("input");
    expect(inhouse.checked).toBe(true);
    expect(document.body.textContent).not.toContain("Please select a report type above");
    expect(dateFor("From Date")).toBeTruthy();
    expect(button("Search")).toBeTruthy();
  });

  it("Day Wise: stay dates, hotel ids and the room category name", async () => {
    await render(<DayWise />);
    await act(async () => type(dateFor("From Date"), "2026-04-25"));
    await act(async () => type(dateFor("To Date"), "2026-04-26"));
    await click("pick hotel");
    await click("pick hotel type");
    await click("pick room");
    await click("Search");
    await act(async () => type(input("search here"), "minnu"));

    const body = await sendMail();

    expect(body).toEqual({
      email: "ops@example.com",
      reportType: "daywise",
      subType: "inhouse",
      filters: {
        stayFromDate: "2026-04-25",
        stayToDate: "2026-04-26",
        hotelId: 1,
        hotelTypeId: 3,
        roomCategoryName: "Junior Suite",
        searchQuery: "minnu",
      },
    });
  });

  it.each([
    ["Agent Wise", AgentWise, "search here", true],
    ["Day Wise", DayWise, "search here", true],
    ["Monthly Wise", MonthlyWise, "search here", true],
    ["Accounts", Accounts, "search here", false],
    ["Booking", BookingReport, "Search here", false],
    ["Cancellation", CancellationReport, "Search", false],
  ])("%s: search box on the left, Search / Reset just before Mail", async (_name, Page, placeholder, hasInhouse) => {
    await render(<Page />);
    if (hasInhouse) await pickInhouse();

    const search = input(placeholder);
    const row = search.closest(".row");
    const [left, right] = Array.from(row.children);
    expect(left.className).toContain("col-md-2");
    expect(left.contains(search)).toBe(true);
    expect(right.className).toContain("col-md-10");
    expect(Array.from(right.querySelectorAll("button")).map((b) => b.textContent.trim()))
      .toEqual(["Search", "Reset", "Mail", "Print", "PDF", "Excel"]);
  });

  it("Agent Wise shows the hotel category's name, not its id", async () => {
    axiosInstance.get.mockImplementation((url) => Promise.resolve({
      data: url === "/api/reports/agentwise"
        ? [
            { agentName: "Subin Suresh", hotelName: "Test Hotel", hotelCategory: 1, hotelCategoryName: "3", noOfBooking: 46 },
            { agentName: "Subin Suresh", hotelName: "Old Hotel", hotelCategory: 2, noOfBooking: 1 },
          ]
        : LOOKUPS[url] || [],
    }));
    await render(<AgentWise />);
    await pickInhouse();

    const categories = () =>
      Array.from(document.body.querySelectorAll("tbody tr")).map((tr) => tr.children[4].textContent.trim());
    expect(categories()).toEqual(["3", "2"]); // the id only when the server sent no name

    await act(async () => type(input("search here"), "3"));
    expect(categories()).toEqual(["3"]);
  });

  it("Hotel Wise shows category names and filters by the category's id", async () => {
    axiosInstance.get.mockImplementation((url) => Promise.resolve({
      data: url === "/api/hotelWiseReport/report"
        ? [
            { hotelName: "Test Hotel", hotelCategory: 1, hotelCategoryName: "3" },
            { hotelName: "Golden Hotel", hotelCategory: 2, hotelCategoryName: "Boutique" },
            { hotelName: "Old Hotel", hotelCategory: 4 },
          ]
        : LOOKUPS[url] || [],
    }));
    await render(<HotelWise />);
    const rows = () =>
      Array.from(document.body.querySelectorAll("tbody tr")).map(
        (tr) => `${tr.children[1].textContent.trim()}: ${tr.children[3].textContent.trim()}`
      );
    expect(rows()).toEqual(["Test Hotel: 3 Star", "Golden Hotel: Boutique", "Old Hotel: 4"]);

    await click("pick category"); // the Hotel Category filter sends id 2
    await click("Search");
    expect(rows()).toEqual(["Golden Hotel: Boutique"]);
  });

  it("Monthly Wise shows category names, not ids", async () => {
    axiosInstance.get.mockImplementation((url) => Promise.resolve({
      data: url.startsWith("/api/reports/monthly-wise-bookings")
        ? [{ hotelId: 1, hotelName: "Test Hotel", hotelCategoryId: 1, hotelCategory: 1, hotelCategoryName: "3", month: "APRIL" }]
        : LOOKUPS[url] || [],
    }));
    await render(<MonthlyWise />);
    await pickInhouse();

    const cells = Array.from(document.body.querySelector("tbody tr").children).map((td) => td.textContent.trim());
    expect(cells[3]).toBe("3 Star");
  });

  it("Monthly Wise: the month as a number and a lower-case report type", async () => {
    await render(<MonthlyWise />);
    await pickInhouse();
    await click("pick month");
    await click("pick category");
    await click("Search");

    const body = await sendMail();

    expect(body).toEqual({
      email: "ops@example.com",
      reportType: "monthlywise",
      subType: "inhouse",
      filters: { month: 4, hotelCategoryId: 2 },
    });
  });
});
