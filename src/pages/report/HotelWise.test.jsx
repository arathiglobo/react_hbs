import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import axiosInstance from "../../components/AxiosInstance";
import HotelWise from "./HotelWise";

jest.mock("../../components/AxiosInstance", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../../components/Sidebar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/TopBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/BackButton", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/Hotelfilters", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/HotelTypefilters", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/HotelCategory", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/RoomCategory", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/Region", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/State", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/filters/Supplier", () => ({ __esModule: true, default: () => null }));
jest.mock("jspdf", () => jest.fn());
jest.mock("jspdf-autotable", () => jest.fn());
jest.mock("react-hot-toast", () => {
  const toast = { error: jest.fn(), success: jest.fn() };
  return { __esModule: true, toast, default: toast };
});

// Master data larger than the old lookups loaded: /api/country defaults to 50
// rows and the old place lookup loaded only the first 1000 destinations.
const COUNTRIES = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  name: i === 55 ? "India" : `Country ${i + 1}`,
}));
const PLACES = Array.from({ length: 1200 }, (_, i) => ({
  id: i + 1,
  name: i === 1100 ? "Kochi" : `Place ${i + 1}`,
  country: i === 1100 ? "India" : "Elsewhere",
}));
const ROWS = [
  { hotelName: "Hotel Dubai", country: "United Arab Emirates", place: "Dubai" },
  { hotelName: "Hotel Kochi", country: "India", place: "Kochi" },
  { hotelName: "Hotel Delhi", country: "India", place: "New Delhi" },
];

// Mirrors the backend's paging defaults and prefix search.
const fakeGet = (url, config = {}) => {
  if (url === "/api/hotelWiseReport/report") return Promise.resolve({ data: ROWS });
  if (url.startsWith("/api/country")) {
    const limit = Number(new URLSearchParams(url.split("?")[1] || "").get("limit") || 50);
    return Promise.resolve({ data: COUNTRIES.slice(0, limit) });
  }
  if (url.startsWith("/api/destination")) {
    const params = { ...Object.fromEntries(new URLSearchParams(url.split("?")[1] || "")), ...config.params };
    const search = (params.search || "").toLowerCase();
    const matches = PLACES.filter((p) => p.name.toLowerCase().startsWith(search));
    return Promise.resolve({ data: matches.slice(0, Number(params.limit || 80000)) });
  }
  return Promise.resolve({ data: [] });
};

const type = (el, value) => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const wait = (ms) => act(() => new Promise((r) => setTimeout(r, ms)));
const inputFor = (root, label) =>
  Array.from(root.querySelectorAll("label"))
    .find((l) => l.textContent.trim() === label)
    .parentElement.querySelector("input");
const option = (root, text) =>
  Array.from(root.querySelectorAll("div.px-3.py-2")).find((el) => el.textContent.trim().startsWith(text));
const buttonByText = (root, text) =>
  Array.from(root.querySelectorAll("button")).find((b) => b.textContent.trim() === text);
const hotelNames = (root) =>
  Array.from(root.querySelectorAll("tbody tr")).map((tr) => tr.children[1]?.textContent.trim());

describe("HotelWise country and place filters", () => {
  let container;
  let root;

  beforeEach(async () => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "log").mockImplementation(() => {});
    axiosInstance.get.mockImplementation(fakeGet);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<HotelWise />));
    await wait(0);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("filters by a country that is past the first 50 countries", async () => {
    const input = inputFor(container, "Country");
    await act(async () => input.focus());
    await act(async () => type(input, "Ind"));
    await act(async () => option(container, "India").click());
    await act(async () => buttonByText(container, "Search").click());
    await wait(0);

    expect(hotelNames(container)).toEqual(["Hotel Kochi", "Hotel Delhi"]);
  });

  it("finds and filters by a place that is past the first 1000 destinations", async () => {
    const input = inputFor(container, "Place");
    await act(async () => input.focus());
    await act(async () => type(input, "Koc"));
    await wait(350); // search debounce

    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/destination",
      expect.objectContaining({ params: expect.objectContaining({ search: "Koc" }) })
    );
    await act(async () => option(container, "Kochi").click());
    expect(input.value).toBe("Kochi");

    await act(async () => buttonByText(container, "Search").click());
    await wait(0);

    expect(hotelNames(container)).toEqual(["Hotel Kochi"]);
  });

  it("clears the country and place filters on Reset", async () => {
    const country = inputFor(container, "Country");
    await act(async () => country.focus());
    await act(async () => option(container, "India").click());
    await act(async () => buttonByText(container, "Search").click());
    await wait(0);
    expect(hotelNames(container)).toHaveLength(2);

    await act(async () => buttonByText(container, "Reset").click());
    await wait(0);

    expect(country.value).toBe("");
    expect(hotelNames(container)).toEqual(["Hotel Dubai", "Hotel Kochi", "Hotel Delhi"]);
  });
});
