import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";

import axiosInstance from "../../components/AxiosInstance";
import OfflineBookingList from "./OfflineBookingList";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** A row as GET /api/v1/offline-booking/all-list returns it — no hotel lines, no total. */
const bareBooking = {
  bookingDate: "2026-11-13 16:41:21",
  invoiceNumber: "INV-GLB-0032",
  agentName: "Globo_Melvin",
  agentFullName: "",
  customerName: "Test",
  checkIn: "2026-11-20",
  checkOut: "2026-11-21",
  totalPax: 1,
  adult: 1,
  child: 0,
  totalAmount: null,
  currency: null,
  bookerName: "adminSubin",
  hotelName: null,
  bookingStatus: "Confirmed",
  supplierMainBasicId: 32,
  totalRooms: 0,
  roomSummary: [],
};

/** A row with a hotel line and a grand total. */
const fullBooking = {
  ...bareBooking,
  invoiceNumber: "INV-GLB-0010",
  supplierMainBasicId: 10,
  customerName: "Mr test",
  checkIn: "2026-11-02",
  checkOut: "2026-11-04",
  totalPax: 3,
  adult: 2,
  child: 1,
  totalAmount: 1450,
  currency: "AED",
  hotelName: "Silver Hotel",
  bookingStatus: "Completed",
  totalRooms: 1,
  roomSummary: [{ roomType: "Classic Room", count: 1 }],
};

const cellTexts = (row) => Array.from(row.querySelectorAll("td")).map((td) => td.textContent.trim());

describe("OfflineBookingList", () => {
  let host;
  let root;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    axiosInstance.get.mockReset();
    axiosInstance.get.mockResolvedValue({
      data: { content: [bareBooking, fullBooking], totalElements: 2, totalPages: 1 },
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    sessionStorage.clear();
    localStorage.clear();
  });

  const render = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/booking-details/offline-booking-list"]}>
          <OfflineBookingList />
        </MemoryRouter>,
      );
    });
    await act(async () => {});
  };

  const headers = () => Array.from(host.querySelectorAll("thead th")).map((th) => th.textContent.trim());
  const rows = () => Array.from(host.querySelectorAll("tbody tr"));

  test("an admin sees the same agent, pax, booker, dates and status as the All Bookings list", async () => {
    sessionStorage.setItem("userRole", "ADMIN");
    sessionStorage.setItem("currentActiveRole", "ADMIN");
    // A role an older build left in localStorage must not change the view.
    localStorage.setItem("currentActiveRole", "staff");

    await render();

    expect(headers()).toEqual([
      "S.N", "Booking Date", "Invoice", "Agent", "Pax Name", "Pax", "Hotel",
      "Booker", "Check In", "Check Out", "No. of Rooms", "Total", "Status", "Action",
    ]);
    // Admin sees every agency's bookings: no agentId sent.
    expect(axiosInstance.get.mock.calls[0][1].params.agentId).toBeUndefined();

    const [bare, full] = rows().map(cellTexts);
    expect(bare.slice(0, 13)).toEqual([
      "1", "13 Nov 2026", "INV-GLB-0032", "Globo_Melvin", "Test", "11 adult", "-",
      "adminSubin", "20 Nov 2026", "21 Nov 2026", "-", "-", "Confirmed",
    ]);
    expect(full.slice(0, 13)).toEqual([
      "2", "13 Nov 2026", "INV-GLB-0010", "Globo_Melvin", "Mr test", "32 adults, 1 child",
      "Silver Hotel", "adminSubin", "02 Nov 2026", "04 Nov 2026", "1 Room1 × Classic Room",
      "AED 1,450.00", "Completed",
    ]);
  });

  test("check-in/out dates don't move a day west of UTC", async () => {
    const savedTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      sessionStorage.setItem("userRole", "ADMIN");
      sessionStorage.setItem("currentActiveRole", "ADMIN");
      await render();
      expect(cellTexts(rows()[0]).slice(8, 10)).toEqual(["20 Nov 2026", "21 Nov 2026"]);
    } finally {
      process.env.TZ = savedTz;
    }
  });

  test("an agent gets no Agent column and only its own bookings", async () => {
    sessionStorage.setItem("userRole", "AGENT");
    sessionStorage.setItem("currentActiveRole", "AGENT");
    sessionStorage.setItem("userId", "37");

    await render();

    expect(headers()).not.toContain("Agent");
    expect(axiosInstance.get.mock.calls[0][1].params.agentId).toBe("37");
    expect(cellTexts(rows()[0]).slice(3, 9)).toEqual([
      "Test", "11 adult", "-", "adminSubin", "20 Nov 2026", "21 Nov 2026",
    ]);
  });
});
