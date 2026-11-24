import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import axiosInstance from "../../components/AxiosInstance";
import { toast } from "react-hot-toast";
import BookingReport from "./BookingReport";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/BackButton", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/Supplier", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/DestinationCity", () => ({ __esModule: true, default: () => null }));
jest.mock("jspdf", () => jest.fn());
jest.mock("jspdf-autotable", () => jest.fn());
jest.mock("react-hot-toast", () => {
  const toast = { error: jest.fn(), success: jest.fn() };
  return { __esModule: true, toast, default: toast };
});

// Sets a controlled input's value the way a user typing would.
const type = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const byText = (root, selector, text) =>
  Array.from(root.querySelectorAll(selector)).find((el) => el.textContent.trim() === text);

describe("BookingReport Mail", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    axiosInstance.get.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const renderAndSearch = async () => {
    await act(async () => {
      root.render(<BookingReport />);
    });
    await act(async () => {
      type(container.querySelector('input[placeholder="Booking Reference"]'), "GLB");
    });
    await act(async () => {
      byText(container, "button", "Search").click();
    });
    // Edited after Search — not what the table shows, so not mailed.
    await act(async () => {
      type(container.querySelector('input[placeholder="Guest Name"]'), "Late edit");
      type(container.querySelector('input[placeholder="Search here"]'), "akhil");
    });
  };

  const sendMail = async (address) => {
    await act(async () => {
      byText(container, "button", "Mail").click();
    });
    await act(async () => {
      type(document.body.querySelector('input[type="email"]'), address);
    });
    await act(async () => {
      byText(document.body, "button", "Send Email").click();
    });
  };

  it("sends the booking report type with the searched filters and search text", async () => {
    axiosInstance.post.mockResolvedValue({ data: { message: "ok", recordCount: 3 } });
    await renderAndSearch();

    await sendMail("ops@example.com");

    expect(axiosInstance.post).toHaveBeenCalledWith("/api/reports/send-email", {
      email: "ops@example.com",
      reportType: "booking",
      filters: { bookingReference: "GLB", searchQuery: "akhil" },
    });
    expect(toast.success).toHaveBeenCalledWith("Report sent successfully (3 bookings)");
  });

  it("shows the server's reason when sending fails", async () => {
    axiosInstance.post.mockRejectedValue({
      response: { data: { message: "Failed to send email: SMTP down" } },
    });
    await renderAndSearch();

    await sendMail("ops@example.com");

    expect(toast.error).toHaveBeenCalledWith("Failed to send email: SMTP down");
  });
});
