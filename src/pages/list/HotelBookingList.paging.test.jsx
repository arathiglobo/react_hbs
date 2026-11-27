import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";

import axiosInstance from "../../components/AxiosInstance";
import HotelBookingList from "./HotelBookingList";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// 22 regular bookings and 3 religious ones (those have their own list page).
const booking = (i, extra = {}) => ({
  bookingId: i,
  bookingCode: `GLBIN${i}`,
  agentName: "Globo_Melvin",
  primaryGuestName: `Guest ${i}`,
  hotelName: "Silver Hotel",
  bookingDate: "2026-11-11T10:00:00",
  checkInDate: "2026-11-20T00:00:00",
  checkOutDate: "2026-11-21T00:00:00",
  confirmationStatus: "Confirmed",
  ...extra,
});
const ROWS = [
  ...Array.from({ length: 22 }, (_, i) => booking(i + 1)),
  ...[101, 102, 103].map((i) => booking(i, { religiousBooking: true })),
];

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const listAllCalls = () => axiosInstance.get.mock.calls.filter(([url]) => url === "/api/bookings/list/all");
const pageButtons = (root) =>
  Array.from(root.querySelectorAll(".pagination li"))
    .slice(1, -1)
    .map((li) => li.textContent.replace(/\(current\)/, "").trim());
const codes = (root) =>
  Array.from(root.querySelectorAll("tbody tr"))
    .map((tr) => (tr.textContent.match(/GLBIN\d+/) || [])[0])
    .filter(Boolean);

describe("Hotel Booking List paging", () => {
  let container;
  let root;

  beforeEach(async () => {
    sessionStorage.setItem("currentActiveRole", "ADMIN");
    axiosInstance.get.mockImplementation((url) => {
      if (url === "/api/bookings/list/all") {
        return Promise.resolve({
          data: { success: true, bookings: { content: ROWS, totalElements: ROWS.length, totalPages: 1 } },
        });
      }
      return Promise.resolve({ data: {} });
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <MemoryRouter>
          <HotelBookingList />
        </MemoryRouter>
      )
    );
    await flush();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    sessionStorage.clear();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("loads the whole list without 24-hour rows and counts only the rows it shows", () => {
    const [, { params }] = listAllCalls()[listAllCalls().length - 1];
    expect(params).toMatchObject({ page: 0, size: 10000, is24HourCheckin: false });

    expect(container.textContent).toMatch(/Showing\s*1\s*to\s*10\s*of\s*22\s*entries/);
    expect(pageButtons(container)).toEqual(["1", "2", "3"]);
    expect(codes(container)).toHaveLength(10);
    expect(codes(container).some((c) => ["GLBIN101", "GLBIN102", "GLBIN103"].includes(c))).toBe(false);
  });

  it("pages in the browser without downloading the list again", async () => {
    const calls = listAllCalls().length;
    const page3 = Array.from(container.querySelectorAll(".pagination .page-link"))
      .find((el) => el.textContent.trim() === "3");
    await act(async () => page3.click());
    await flush();

    expect(listAllCalls()).toHaveLength(calls);
    expect(container.textContent).toMatch(/Showing\s*21\s*to\s*22\s*of\s*22\s*entries/);
    expect(codes(container)).toEqual(["GLBIN21", "GLBIN22"]);
  });
});
