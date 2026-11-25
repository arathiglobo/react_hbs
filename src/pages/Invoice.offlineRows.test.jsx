import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";

import axiosInstance from "../components/AxiosInstance";
import Invoice from "./Invoice";

jest.mock("../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("react-hot-toast", () => {
  const toast = { error: jest.fn(), success: jest.fn() };
  return { __esModule: true, toast, default: toast };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Offline bookings are numbered in their own table, so an offline row and a
// hotel row can both carry bookingId 36 — the case that opened the wrong invoice.
const ROWS = [
  { bookingId: 36, bookingType: "Offline", bookingCode: "INV-GLB-0036", customerName: "Test", agentName: "Globo_Melvin" },
  { bookingId: 36, bookingType: "Last Minute", bookingCode: "GLLM1778227758", customerName: "Mr Pradeep test", agentName: "Globo_Melvin" },
];
const PDF = { data: { status: "SUCCESS", pdfUrl: "http://localhost/pdf/test.pdf", message: "ok" } };

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const button = (label) => document.body.querySelector(`button[aria-label="${label}"]`);
const click = async (label) => {
  await act(async () => button(label).click());
  await flush();
};

describe("Tax Invoice List — offline rows open their own invoice", () => {
  let container;
  let root;

  beforeEach(async () => {
    axiosInstance.get.mockImplementation((url) => {
      if (url.startsWith("/api/unified-bookings/list")) {
        return Promise.resolve({ data: { content: ROWS, totalElements: ROWS.length, totalPages: 1 } });
      }
      if (url.startsWith("/api/offline_booking/")) return Promise.resolve(PDF);
      return Promise.resolve({ data: [] });
    });
    axiosInstance.post.mockResolvedValue(PDF);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <MemoryRouter>
          <Invoice />
        </MemoryRouter>
      )
    );
    await flush();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("Proforma on an offline row asks for the offline booking's invoice", async () => {
    await click("Proforma invoice for booking INV-GLB-0036");

    expect(axiosInstance.get).toHaveBeenCalledWith("/api/offline_booking/36/pdf", { params: { type: "INVOICE" } });
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("Tax on an offline row asks for the offline booking's tax invoice", async () => {
    await click("Tax invoice for booking INV-GLB-0036");

    expect(axiosInstance.get).toHaveBeenCalledWith("/api/offline_booking/36/pdf", { params: { type: "TAX" } });
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("hotel rows still use the hotel invoice endpoint", async () => {
    await click("Proforma invoice for booking GLLM1778227758");
    await click("Tax invoice for booking GLLM1778227758");

    expect(axiosInstance.post).toHaveBeenCalledWith("/api/invoice-generation/generate/36?invoiceType=PROFORMA");
    expect(axiosInstance.post).toHaveBeenCalledWith("/api/invoice-generation/generate/36?invoiceType=TAX");
    expect(axiosInstance.get).not.toHaveBeenCalledWith(expect.stringContaining("/api/offline_booking/"), expect.anything());
  });
});
