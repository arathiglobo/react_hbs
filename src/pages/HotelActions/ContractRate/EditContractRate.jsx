import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Spinner,
  Table,
  Overlay,
  Popover,
} from "react-bootstrap";
import { FaArrowLeft, FaSave, FaPlus } from "react-icons/fa";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

// ---- Date-time picker with explicit Apply / Cancel --------------------
// Mirrors the picker on /hotel-actions/{id}/occupancy-and-minimumlength so
// the Validity Periods section here shows the same calendar + AM/PM time
// spinner UI instead of the browser-native datetime-local input.
const pad2 = (n) => String(n).padStart(2, "0");

const parseLocalDateTime = (str) => {
  if (!str) return null;
  const [datePart, timePart = "00:00"] = str.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0);
};

const formatLocalDateTime = (date) => {
  if (!date) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => CURRENT_YEAR - 10 + i);

const formatDisplay = (date) => {
  if (!date) return "";
  const h24 = date.getHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()} ${pad2(
    h12,
  )}:${pad2(date.getMinutes())} ${ampm}`;
};

const sameDay = (a, b) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const buildCalendar = (view) => {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const DateTimeApplyPicker = ({
  value,
  onApply,
  disabled = false,
  isInvalid = false,
  minDate,
  placeholder = "Select date & time",
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(parseLocalDateTime(value));
  const [viewDate, setViewDate] = useState(
    parseLocalDateTime(value) || new Date(),
  );
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hourText, setHourText] = useState("");
  const [minuteText, setMinuteText] = useState("");

  useEffect(() => {
    setDraft(parseLocalDateTime(value));
  }, [value]);

  const computePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 470;
    const H = 360;
    let left = r.left;
    if (left + W > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - W - 8);
    }
    let top = r.bottom + 4;
    if (top + H > window.innerHeight - 8) {
      const above = r.top - H - 4;
      top = above > 8 ? above : Math.max(8, window.innerHeight - H - 8);
    }
    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      const inInput = wrapRef.current && wrapRef.current.contains(e.target);
      const inPopup = popupRef.current && popupRef.current.contains(e.target);
      if (!inInput && !inPopup) {
        setDraft(parseLocalDateTime(value));
        setOpen(false);
      }
    };
    const onReflow = () => computePos();
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, value]);

  const openPicker = () => {
    if (disabled) return;
    const init = parseLocalDateTime(value) || new Date();
    init.setSeconds(0, 0);
    setDraft(init);
    setViewDate(init);
    computePos();
    setOpen(true);
  };

  const handleApply = () => {
    onApply(formatLocalDateTime(draft));
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(parseLocalDateTime(value));
    setOpen(false);
  };

  const handleClear = () => {
    setDraft(null);
    onApply("");
    setOpen(false);
  };

  const draftHour24 = draft ? draft.getHours() : 0;
  const draftAmPm = draftHour24 >= 12 ? "PM" : "AM";
  const draftHour12 = draftHour24 % 12 === 0 ? 12 : draftHour24 % 12;
  const draftMinute = draft ? draft.getMinutes() : 0;

  useEffect(() => {
    setHourText(pad2(draftHour12));
    setMinuteText(pad2(draftMinute));
  }, [draftHour12, draftMinute]);

  const ensureDraft = () => {
    const base = draft ? new Date(draft) : new Date();
    base.setSeconds(0, 0);
    return base;
  };

  const stepHour = (delta) => {
    const base = ensureDraft();
    base.setHours((base.getHours() + delta + 24) % 24);
    setDraft(base);
  };

  const stepMinute = (delta) => {
    const base = ensureDraft();
    base.setMinutes((base.getMinutes() + delta + 60) % 60);
    setDraft(base);
  };

  const setAmPm = (ampm) => {
    const base = ensureDraft();
    const isPM = base.getHours() >= 12;
    if (ampm === "PM" && !isPM) base.setHours(base.getHours() + 12);
    if (ampm === "AM" && isPM) base.setHours(base.getHours() - 12);
    setDraft(base);
  };

  const commitHour = () => {
    const h = parseInt(hourText.replace(/\D/g, ""), 10);
    if (Number.isNaN(h)) {
      setHourText(pad2(draftHour12));
      return;
    }
    const clamped = Math.min(12, Math.max(1, h));
    const base = ensureDraft();
    base.setHours((clamped % 12) + (draftAmPm === "PM" ? 12 : 0));
    setDraft(base);
  };

  const commitMinute = () => {
    const m = parseInt(minuteText.replace(/\D/g, ""), 10);
    if (Number.isNaN(m)) {
      setMinuteText(pad2(draftMinute));
      return;
    }
    const clamped = Math.min(59, Math.max(0, m));
    const base = ensureDraft();
    base.setMinutes(clamped);
    setDraft(base);
  };

  const setMonth = (m) =>
    setViewDate((prev) => new Date(prev.getFullYear(), m, 1));
  const setYear = (y) =>
    setViewDate((prev) => new Date(y, prev.getMonth(), 1));

  const selectDay = (day) => {
    if (minDate && startOfDay(day) < startOfDay(minDate)) return;
    const base = ensureDraft();
    base.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setDraft(base);
  };

  const gotoMonth = (delta) => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  };

  const committed = parseLocalDateTime(value);
  const days = buildCalendar(viewDate);

  return (
    <div className="cdt" ref={wrapRef}>
      <input
        type="text"
        readOnly
        value={formatDisplay(committed)}
        placeholder={placeholder}
        onClick={openPicker}
        disabled={disabled}
        className={`form-control ${isInvalid ? "is-invalid" : ""}`}
        autoComplete="off"
      />

      {open &&
        !disabled &&
        createPortal(
          <div
            className="cdt-popup"
            ref={popupRef}
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="cdt-body">
              <div className="cdt-cal">
                <div className="cdt-cal-head">
                  <button
                    type="button"
                    className="cdt-nav"
                    onClick={() => gotoMonth(-1)}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="cdt-cal-selects">
                    <select
                      className="cdt-select"
                      value={viewDate.getMonth()}
                      onChange={(e) => setMonth(Number(e.target.value))}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      className="cdt-select"
                      value={viewDate.getFullYear()}
                      onChange={(e) => setYear(Number(e.target.value))}
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="cdt-nav"
                    onClick={() => gotoMonth(1)}
                    aria-label="Next month"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="cdt-grid cdt-grid-dow">
                  {WEEKDAYS.map((d) => (
                    <span key={d} className="cdt-dow">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="cdt-grid">
                  {days.map((day, i) => {
                    const outside = day.getMonth() !== viewDate.getMonth();
                    const isSel = sameDay(day, draft);
                    const isDisabled =
                      !!minDate && startOfDay(day) < startOfDay(minDate);
                    return (
                      <button
                        type="button"
                        key={i}
                        disabled={isDisabled}
                        onClick={() => selectDay(day)}
                        className={`cdt-day${outside ? " cdt-day-out" : ""}${
                          isSel ? " cdt-day-sel" : ""
                        }${isDisabled ? " cdt-day-disabled" : ""}`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="cdt-time">
                <div className="cdt-stepper">
                  <button
                    type="button"
                    className="cdt-chev"
                    onClick={() => stepHour(1)}
                    aria-label="Hour up"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <input
                    className="cdt-num"
                    inputMode="numeric"
                    maxLength={2}
                    value={hourText}
                    onChange={(e) =>
                      setHourText(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    onBlur={commitHour}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-label="Hour"
                  />
                  <button
                    type="button"
                    className="cdt-chev"
                    onClick={() => stepHour(-1)}
                    aria-label="Hour down"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>

                <span className="cdt-sep">:</span>

                <div className="cdt-stepper">
                  <button
                    type="button"
                    className="cdt-chev"
                    onClick={() => stepMinute(1)}
                    aria-label="Minute up"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <input
                    className="cdt-num"
                    inputMode="numeric"
                    maxLength={2}
                    value={minuteText}
                    onChange={(e) =>
                      setMinuteText(
                        e.target.value.replace(/\D/g, "").slice(0, 2),
                      )
                    }
                    onBlur={commitMinute}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-label="Minute"
                  />
                  <button
                    type="button"
                    className="cdt-chev"
                    onClick={() => stepMinute(-1)}
                    aria-label="Minute down"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>

                <div className="cdt-ampm">
                  <button
                    type="button"
                    className={`cdt-ampm-btn${draftAmPm === "AM" ? " active" : ""}`}
                    onClick={() => setAmPm("AM")}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    className={`cdt-ampm-btn${draftAmPm === "PM" ? " active" : ""}`}
                    onClick={() => setAmPm("PM")}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            <div className="cdt-footer">
              <button type="button" className="cdt-clear" onClick={handleClear}>
                Clear
              </button>
              <div className="cdt-foot-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleApply}
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default function EditContractRate() {
  const navigate = useNavigate();
  const { id, contractRateId } = useParams(); // id = hotelId, contractRateId = contract rate ID
  const { pathname } = useLocation();
  const isExtranet = pathname.startsWith("/extranet");
  const navBase = isExtranet ? "/extranet" : "/hotel-actions";
  const backUrl = isExtranet ? "/extranetDashboard" : `/hotel-details/${id}`;

  const [formData, setFormData] = useState({
    seasonId: "",
    rateCode: "",
    marketType: [],
    excludeCountry: [],
    daySelection: "allDays", // "allDays", "weekDays", "weekendDays"
    validityList: [{ validityFrom: "", validityTo: "" }],
    roomRates: [],
  });

  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [seasonTypes, setSeasonTypes] = useState([]);
  const [fetchingData, setFetchingData] = useState(true);

  // Cell confirmation popup state
  const [showCellConfirm, setShowCellConfirm] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmData, setConfirmData] = useState(null);

  // ✅ Helper function to get minimum date for Validity To (From date + 1 minute)
  const getMinValidityToDate = (fromDate) => {
    if (!fromDate) return "";
    return fromDate; // Allow same day, just ensure it's validated to be after
  };

  // ✅ Fetch dropdowns
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        setLoading(true);
        const [marketRes, countryRes, seasonTypeRes] = await Promise.all([
          axiosInstance.get("/api/marketType"),
          axiosInstance.get("/api/country"),
          axiosInstance.get("/api/seasonType"),
        ]);

        // Add "All" option with value -1 at the beginning
        const marketsWithAll = [
          { marketTypeId: 100, name: "All" },
          ...(marketRes.data || [])
        ];

        setMarkets(marketsWithAll);
        setCountries(countryRes.data || []);
        setFilteredCountries(countryRes.data || []);
        setSeasonTypes(seasonTypeRes.data || []);
      } catch {
        toast.error("Failed to load dropdown data");
      } finally {
        setLoading(false);
      }
    };
    fetchDropdowns();
  }, []);

  // ✅ Fetch existing contract rate data
  useEffect(() => {
    const fetchContractRateData = async () => {
      if (!contractRateId || markets.length === 0 || countries.length === 0) return;
      try {
        setFetchingData(true);
        const res = await axiosInstance.get(`/api/hotelContractRate/${contractRateId}`);

        console.log("🔍 API Response for Contract Rate:", res.data);

        if (res.data) {
          const data = res.data;

          // Map market types - handle both array of IDs and array of objects
          const selectedMarkets = data.markeType?.map(apiMarket => {
            // If apiMarket is just an ID (number), find the market by ID
            if (typeof apiMarket === 'number') {
              const matchingMarket = markets.find(m => m.marketTypeId === apiMarket);
              return {
                value: apiMarket,
                label: matchingMarket?.name || `Market ${apiMarket}`
              };
            }
            // If apiMarket is an object, use existing logic
            const matchingMarket = markets.find(m =>
              m.marketTypeId === apiMarket.marketTypeId || m.marketTypeId === apiMarket.id
            );
            return {
              value: apiMarket.marketTypeId || apiMarket.id,
              label: apiMarket.name || matchingMarket?.name || 'Unknown Market'
            };
          }).filter(market => market.label !== 'Unknown Market') || [];

          // Map exclude countries - ensure we match with available countries
          const selectedCountries = data.excludeCountry?.map(apiCountry => {
            const matchingCountry = countries.find(c => c.id === apiCountry.id);
            return {
              value: apiCountry.id,
              label: `${apiCountry.name || matchingCountry?.name || 'Unknown Country'} (${apiCountry.marketType || matchingCountry?.marketType || ''})`
            };
          }).filter(country => !country.label.includes('Unknown Country')) || [];

          // Determine day selection
          let daySelection = "allDays";
          if (data.allDays === 1) {
            daySelection = "allDays";
          } else if (data.weekDay === 1) {
            daySelection = "weekDays";
          } else if (data.weekEndDay === 1) {
            daySelection = "weekendDays";
          }

          // Map validity periods
          const validityList = data.contractRateValidityDTO?.map(validity => ({
            validityFrom: validity.validityFrom ? validity.validityFrom.substring(0, 16) : "",
            validityTo: validity.validityTo ? validity.validityTo.substring(0, 16) : ""
          })) || [{ validityFrom: "", validityTo: "" }];

          // Map room rates
          const roomRates = data.contractRateRoomDTO?.map(room => ({
            hotelRoomcategoryId: String(room.hotelRoomcategoryId),
            hotelRoomtypeId: String(room.hotelRoomtypeId),
            ocuppancytypeId: String(room.ocuppancytypeId),
            mealType: room.mealType || "Room Only",
            hotelMealId: room.hotelMealId || 0,
            rate: room.rate || 0,
            adultRate: room.adultRate || 0,
            childRate: room.childRate || 0,
            meal: Boolean(room.meal),
            extraBed: Boolean(room.extraBed),
            // Legacy rows may carry null; treat as Refundable by default so the
            // new mandatory radio always loads a selection.
            refundable: room.refundable === null || room.refundable === undefined
              ? true
              : Boolean(room.refundable),
          })) || [];

          setFormData({
            seasonId: String(data.seasonId || ""),
            rateCode: data.rateCode || "",
            marketType: selectedMarkets,
            excludeCountry: selectedCountries,
            daySelection: daySelection,
            validityList: validityList,
            roomRates: roomRates,
          });

          // Update filtered countries based on selected markets
          if (selectedMarkets.length > 0) {
            const selectedMarketIds = selectedMarkets.map(m => m.value);
            const filtered = countries.filter(c =>
              selectedMarketIds.includes(c.marketTypeId)
            );
            setFilteredCountries(filtered);
          }

          console.log("✅ Contract Rate Data Loaded:", {
            originalData: data,
            selectedMarkets,
            selectedCountries,
            availableMarkets: markets,
            formData: {
              seasonId: String(data.seasonId || ""),
              rateCode: data.rateCode || "",
              marketType: selectedMarkets,
              excludeCountry: selectedCountries,
              daySelection: daySelection,
            }
          });
        }
      } catch (error) {
        console.error("Error fetching contract rate data:", error);
        toast.error("Failed to load contract rate data");
      } finally {
        setFetchingData(false);
      }
    };
    fetchContractRateData();
  }, [contractRateId, markets, countries]);

  // ✅ Fetch hotel rooms
  useEffect(() => {
    const fetchHotelRooms = async () => {
      if (!id) return;
      try {
        setRoomLoading(true);
        const res = await axiosInstance.get(
          `/api/hotelRoomDetailsController/${id}`
        );
        if (res.data) {
          const mappedRooms = res.data.map((room) => {
            // Remove duplicate occupancy entries based on id
            const uniqueOccupancy = room.occupancyDetailsDTOs.reduce((acc, current) => {
              const existingIndex = acc.findIndex(item => item.id === current.id && item.occupanyType === current.occupanyType);
              if (existingIndex === -1) {
                acc.push(current);
              }
              return acc;
            }, []);

            return {
              hotelRoomcategoryId: room.rommCategoryId || room.hotelRoomcategoryId,
              roomCategory: room.roomCategory,
              occupancyDetailsDTOs: uniqueOccupancy,
              roomTypeDetailsDTOs: room.roomTypeDetailsDTOs || [],
            };
          });
          setHotelRooms(mappedRooms);
        }
      } catch {
        toast.error("Failed to load hotel room details");
      } finally {
        setRoomLoading(false);
      }
    };
    fetchHotelRooms();
  }, [id]);

  // ✅ Filter countries based on market
  useEffect(() => {
    if (formData.marketType.length === 0) setFilteredCountries(countries);
    else {
      const selectedIds = formData.marketType.map((m) => m.value);
      const filtered = countries.filter((c) =>
        selectedIds.includes(c.marketTypeId)
      );
      setFilteredCountries(filtered);
    }
  }, [formData.marketType, countries]);

  // ✅ Add/remove validity
  const addValidity = () =>
    setFormData({
      ...formData,
      validityList: [
        ...formData.validityList,
        { validityFrom: "", validityTo: "" },
      ],
    });

  const removeValidity = (index) => {
    const updated = formData.validityList.filter((_, i) => i !== index);
    setFormData({ ...formData, validityList: updated });
  };

  // ✅ Handle refundable radio (Refundable / Non Refundable)
  const handleRefundableChange = (roomId, isRefundable) => {
    setFormData((prev) => {
      const updatedRates = [...prev.roomRates];
      updatedRates.forEach((r) => {
        if (r.hotelRoomcategoryId === String(roomId)) r.refundable = isRefundable;
      });
      return { ...prev, roomRates: updatedRates };
    });
  };

  // ✅ Validation
  const validateForm = () => {
    if (!formData.seasonId) return "Please select a season.";
    if (!formData.rateCode.trim()) return "Please enter a rate code.";
    if (!formData.marketType.length)
      return "Please select at least one market type.";
    if (!formData.validityList.length) return "Please add a validity period.";
    for (const v of formData.validityList) {
      if (!v.validityFrom || !v.validityTo)
        return "Please fill both validity dates.";
      if (new Date(v.validityFrom) >= new Date(v.validityTo))
        return "Validity To must be after Validity From.";
    }

    // Validate room rates
    if (formData.roomRates.length === 0) {
      return "Please add at least one room rate.";
    }

    // Check if any room rate has valid data
    const hasValidRates = formData.roomRates.some(
      (rate) => rate.rate > 0 || rate.adultRate > 0 || rate.childRate > 0
    );

    if (!hasValidRates) {
      return "Please enter at least one valid rate (rate, adult rate, or child rate).";
    }

    // Refundable selection is mandatory per room category.
    const categoriesMissingRefundable = new Set();
    formData.roomRates.forEach((r) => {
      if (r.refundable !== true && r.refundable !== false) {
        categoriesMissingRefundable.add(r.hotelRoomcategoryId);
      }
    });
    if (categoriesMissingRefundable.size > 0) {
      return "Please select Refundable or Non Refundable for every room category.";
    }

    return null;
  };

  // ✅ Handle onBlur for inline cell confirmation
  const handleBlur = (e, roomId, occName, roomTypeId, roomTypeName, field, value) => {
    if (value && Number(value) > 0) {
      const target = e.target;
      // Delay to ensure click events that caused the blur don't immediately trigger rootClose
      setTimeout(() => {
        setConfirmTarget(target);
        setConfirmData({ roomId, occName, roomTypeId, roomTypeName, field, value });
        setShowCellConfirm(true);
      }, 150);
    } else {
      setShowCellConfirm(false);
    }
  };

  // ✅ Handle rate input change
  const handleRateChange = (roomId, occId, roomTypeId, roomTypeName, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.roomRates];
      const idx = updated.findIndex(
        (r) =>
          r.hotelRoomcategoryId === String(roomId) &&
          r.ocuppancytypeId === String(occId) &&
          r.hotelRoomtypeId === String(roomTypeId)
      );

      if (idx !== -1) {
        updated[idx][field] = Number(value);
        // Update extraBed based on adultRate or childRate
        if (field === "adultRate" || field === "childRate") {
          updated[idx].extraBed = Number(value) > 0;
        }
      } else {
        updated.push({
          hotelRoomcategoryId: String(roomId),
          hotelRoomtypeId: String(roomTypeId),
          ocuppancytypeId: String(occId),
          mealType: roomTypeName,
          hotelMealId: roomTypeName.toLowerCase().includes("breakfast") ? 1 : 0,
          rate: field === "rate" ? Number(value) : 0,
          adultRate: field === "adultRate" ? Number(value) : 0,
          childRate: field === "childRate" ? Number(value) : 0,
          meal: roomTypeName.toLowerCase().includes("breakfast"),
          extraBed:
            field === "adultRate" || field === "childRate"
              ? Number(value) > 0
              : false,
          refundable: true,
        });
      }

      return { ...prev, roomRates: updated };
    });
  };

  // ✅ Update Contract Rate
  const handleUpdate = async () => {
    try {
      const errorMsg = validateForm();
      if (errorMsg) return toast.error(errorMsg);

      // Set day values based on radio button selection
      let allDays = 0, weekDay = 0, weekEndDay = 0;

      switch (formData.daySelection) {
        case "allDays":
          allDays = 1;
          break;
        case "weekDays":
          weekDay = 1;
          break;
        case "weekendDays":
          weekEndDay = 1;
          break;
        default:
          allDays = 1;
      }

      const payload = {
        markeType: formData.marketType.map((m) => m.value),
        excludeCountry: formData.excludeCountry.map((c) => c.value),
        hotelId: String(id),
        seasonId: String(formData.seasonId),
        contractrateId: String(contractRateId),
        rateCode: formData.rateCode.trim(),
        weekDay: weekDay,
        weekEndDay: weekEndDay,
        allDays: allDays,
        contractRateValidityDTO: formData.validityList.map((v) => ({
          contractValidityId: "",
          validityFrom: v.validityFrom ? `${v.validityFrom}:00` : v.validityFrom,
          validityTo: v.validityTo ? `${v.validityTo}:00` : v.validityTo,
        })),
        contractRateRoomDTO: formData.roomRates.map((r) => ({
          hotelRoomcategoryId: String(r.hotelRoomcategoryId),
          hotelRoomtypeId: String(r.hotelRoomtypeId),
          refundable: Boolean(r.refundable),
          ocuppancytypeId: Number(r.ocuppancytypeId),
          rate: String(r.rate || "0"),
          extraBed: Boolean(r.extraBed),
          meal: Boolean(r.meal),
          adultRate: String(r.adultRate || "0"),
          childRate: String(r.childRate || "0"),
        })),
      };

      console.log("✅ Day Selection:", formData.daySelection);
      console.log("✅ Day Values - allDays:", allDays, "weekDay:", weekDay, "weekEndDay:", weekEndDay);
      console.log("✅ Update Payload:", JSON.stringify(payload, null, 2));
      console.log("✅ Form Data:", formData);
      console.log("✅ Room Rates:", formData.roomRates);

      const res = await axiosInstance.put(
        `/api/hotelContractRate/${contractRateId}`,
        payload
      );
      console.log("✅ Update Response:", res);

      if (res.status === 200 || res.status === 201) {
        toast.success("Contract Rate updated successfully!");
        navigate(`${navBase}/${id}/contract-rate`);
      }
    } catch (err) {
      console.error("❌ Update Error:", err);
      toast.error(
        `Failed to update contract rate: ${err.response?.data?.message || err.message
        }`
      );
    }
  };

  if (fetchingData) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
              <Spinner animation="border" variant="primary" />
              <span className="ms-3">Loading contract rate data...</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                <FaArrowLeft className="me-2" /> Back
              </Button>
              {/* Title row — HotelTitleBadge resolves the hotel id to
                  its name so the operator can see at a glance which
                  hotel this Contract Rate belongs to. Same component
                  used on the action grid and the list pages. */}
              <h4 className="fw-semibold text-dark mb-0 d-flex align-items-center gap-2">
                Edit Contract Rate
                <HotelTitleBadge hotelId={id} />
              </h4>
              <Button variant="success" onClick={handleUpdate}>
                <FaSave className="me-1" /> Update
              </Button>
            </div>

            <Card className="shadow-sm border-0 rounded-4 p-4">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : (
                <>
                  {/* ✅ Top Form Fields */}
                  <Row className="mb-4 g-4">
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Season</Form.Label>
                        <Form.Select
                          value={formData.seasonId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              seasonId: e.target.value,
                            })
                          }
                        >
                          <option value="">Select Season Type</option>
                          {seasonTypes && seasonTypes.length > 0 && seasonTypes.map((season) => (
                            <option
                              key={season.seasonTypeId}
                              value={season.seasonTypeId}
                            >
                              {season.season}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Rate Code</Form.Label>
                        <Form.Control
                          value={formData.rateCode}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rateCode: e.target.value,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Market Type</Form.Label>
                        <Select
                          isMulti
                          options={markets.map((m) => ({
                            value: m.marketTypeId,
                            label: m.name,
                          }))}
                          value={formData.marketType}
                          onChange={(selected) =>
                            setFormData({ ...formData, marketType: selected })
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group>
                        <Form.Label>Exclude Nationality</Form.Label>
                        <Select
                          isMulti
                          options={filteredCountries.map((c) => ({
                            value: c.id,
                            label: `${c.name} (${c.marketType})`,
                          }))}
                          value={formData.excludeCountry}
                          onChange={(selected) =>
                            setFormData({
                              ...formData,
                              excludeCountry: selected,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* ✅ Day Selection Radio Buttons */}
                  <Row className="mb-4">
                    <Col md={12}>
                      <Card className="p-3 bg-light border-0 rounded-3">
                        <h6 className="fw-bold text-primary mb-3">Day Selection</h6>
                        <Form.Group>
                          <div className="d-flex gap-4">
                            <Form.Check
                              type="radio"
                              id="allDays"
                              name="daySelection"
                              label="All Days"
                              value="allDays"
                              checked={formData.daySelection === "allDays"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  daySelection: e.target.value,
                                })
                              }
                            />
                            <Form.Check
                              type="radio"
                              id="weekDays"
                              name="daySelection"
                              label="Week Days"
                              value="weekDays"
                              checked={formData.daySelection === "weekDays"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  daySelection: e.target.value,
                                })
                              }
                            />
                            <Form.Check
                              type="radio"
                              id="weekendDays"
                              name="daySelection"
                              label="Weekend Days"
                              value="weekendDays"
                              checked={formData.daySelection === "weekendDays"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  daySelection: e.target.value,
                                })
                              }
                            />
                          </div>
                        </Form.Group>
                      </Card>
                    </Col>
                  </Row>

                  {/* ✅ Validity Section */}
                  <Card className="p-3 bg-light border-0 mb-4 rounded-3">
                    <div className="d-flex justify-content-between mb-3">
                      <h6 className="fw-bold text-primary mb-0">
                        Validity Periods
                      </h6>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={addValidity}
                      >
                        <FaPlus className="me-1" /> Add
                      </Button>
                    </div>
                    {formData.validityList.map((v, index) => (
                      <Row key={index} className="align-items-end mb-2">
                        <Col md={4}>
                          <DateTimeApplyPicker
                            value={v.validityFrom || ""}
                            onApply={(val) => {
                              const updated = [...formData.validityList];
                              updated[index].validityFrom = val;

                              const currentToDate =
                                formData.validityList[index].validityTo;
                              if (
                                currentToDate &&
                                val &&
                                new Date(currentToDate) <= new Date(val)
                              ) {
                                updated[index].validityTo = "";
                              }

                              setFormData({
                                ...formData,
                                validityList: updated,
                              });
                            }}
                          />
                        </Col>
                        <Col md={4}>
                          <DateTimeApplyPicker
                            value={v.validityTo || ""}
                            minDate={
                              v.validityFrom
                                ? parseLocalDateTime(v.validityFrom)
                                : undefined
                            }
                            onApply={(val) => {
                              const updated = [...formData.validityList];
                              updated[index].validityTo = val;
                              setFormData({
                                ...formData,
                                validityList: updated,
                              });
                            }}
                          />
                        </Col>
                        <Col md="auto">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeValidity(index)}
                          >
                            ✖
                          </Button>
                        </Col>
                      </Row>
                    ))}
                  </Card>

                  {/* ✅ Room Rate Section */}
                  <Card className="p-3 bg-light border-0 rounded-3">
                    <h6 className="fw-bold mb-3 text-primary">
                      Contract Rate Details
                    </h6>
                    {roomLoading ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" />
                      </div>
                    ) : (
                      hotelRooms.map((room) => (
                        <div
                          key={room.hotelRoomcategoryId}
                          className="border rounded-4 bg-white p-3 mb-4 shadow-sm"
                        >
                          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                            <span className="fw-semibold text-uppercase">
                              {room.roomCategory}
                            </span>
                            {(() => {
                              const current = formData.roomRates.find(
                                (r) => r.hotelRoomcategoryId === String(room.hotelRoomcategoryId)
                              );
                              const isRefundable = current?.refundable === true;
                              const isNonRefundable = current?.refundable === false;
                              const groupName = `refundable-${room.hotelRoomcategoryId}`;
                              return (
                                <div className="d-flex align-items-center gap-3">
                                  <Form.Check
                                    type="radio"
                                    inline
                                    name={groupName}
                                    id={`${groupName}-yes`}
                                    label="Refundable"
                                    checked={isRefundable}
                                    onChange={() =>
                                      handleRefundableChange(room.hotelRoomcategoryId, true)
                                    }
                                  />
                                  <Form.Check
                                    type="radio"
                                    inline
                                    name={groupName}
                                    id={`${groupName}-no`}
                                    label="Non Refundable"
                                    checked={isNonRefundable}
                                    onChange={() =>
                                      handleRefundableChange(room.hotelRoomcategoryId, false)
                                    }
                                  />
                                </div>
                              );
                            })()}
                          </div>

                          <Table bordered hover responsive size="sm">
                            <thead className="table-light">
                              <tr>
                                <th>Occupancy</th>
                                <th>Room Type</th>
                                <th>Rate</th>
                                <th>Extra Adult</th>
                                <th>Extra Child</th>
                              </tr>
                            </thead>
                            <tbody>
                              {room.occupancyDetailsDTOs.length > 0 && room.roomTypeDetailsDTOs.length > 0 ? (
                                room.occupancyDetailsDTOs.map((occ) =>
                                  room.roomTypeDetailsDTOs.map((roomType) => (
                                    <tr key={`${occ.id}-${roomType.roomTypeId}`}>
                                      <td>{occ.occupanyType}</td>
                                      <td>{roomType.roomTypeName}</td>
                                      {["rate", "adultRate", "childRate"].map(
                                        (field) => (
                                          <td key={field}>
                                            <Form.Control
                                              type="number"
                                              min="0"
                                              value={
                                                formData.roomRates.find(
                                                  (r) =>
                                                    r.hotelRoomcategoryId ===
                                                    String(
                                                      room.hotelRoomcategoryId
                                                    ) &&
                                                    r.ocuppancytypeId ===
                                                    String(occ.id) &&
                                                    r.hotelRoomtypeId ===
                                                    String(roomType.roomTypeId)
                                                )?.[field] || ""
                                              }
                                              onChange={(e) =>
                                                handleRateChange(
                                                  room.hotelRoomcategoryId,
                                                  occ.id,
                                                  roomType.roomTypeId,
                                                  roomType.roomTypeName,
                                                  field,
                                                  e.target.value
                                                )
                                              }
                                              onBlur={(e) =>
                                                handleBlur(
                                                  e,
                                                  room.hotelRoomcategoryId,
                                                  occ.occupanyType,
                                                  roomType.roomTypeId,
                                                  roomType.roomTypeName,
                                                  field,
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </td>
                                        )
                                      )}
                                    </tr>
                                  ))
                                )
                              ) : (
                                <tr>
                                  <td colSpan="5" className="text-center text-muted py-3">
                                    No room types or occupancy details available
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      ))
                    )}
                  </Card>

                  {/* ✅ Footer */}
                  <div className="d-flex justify-content-between mt-4">
                    <Button
                      variant="outline-danger"
                      onClick={() => navigate(-1)}
                    >
                      Cancel
                    </Button>
                    <Button variant="success" onClick={handleUpdate}>
                      Update
                    </Button>
                  </div>
                </>
              )}
            </Card>
            {/* ✅ Inline cell confirmation popup */}
            <Overlay show={showCellConfirm} target={confirmTarget} placement="top" rootClose rootCloseEvent="mousedown" onHide={() => setShowCellConfirm(false)}>
              <Popover id="popover-confirm-rate-edit">
                <Popover.Header as="h6" className="py-1 bg-warning text-dark">Confirm Rate</Popover.Header>
                <Popover.Body className="p-2">
                  <div className="mb-2 text-center text-dark" style={{ fontSize: "0.9rem" }}>
                    Verify {confirmData?.field === "rate" ? "Rate" : confirmData?.field === "adultRate" ? "Extra Adult" : "Extra Child"} of <strong>{confirmData?.value}</strong> for {confirmData?.occName} with <strong>{confirmData?.roomTypeName}</strong>?
                  </div>
                  <div className="d-flex justify-content-center gap-2">
                    <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); setShowCellConfirm(false); }}>
                      Yes
                    </Button>
                    <Button size="sm" variant="danger" onClick={(e) => {
                      e.stopPropagation();
                      const currentRoom = hotelRooms.find(r => r.hotelRoomcategoryId === confirmData.roomId);
                      const currentOcc = currentRoom?.occupancyDetailsDTOs.find(o => o.occupanyType === confirmData.occName);

                      handleRateChange(confirmData.roomId, currentOcc?.id || "", confirmData.roomTypeId, confirmData.roomTypeName, confirmData.field, "");
                      setShowCellConfirm(false);
                    }}>
                      No
                    </Button>
                  </div>
                </Popover.Body>
              </Popover>
            </Overlay>
          </Container>
        </main>
      </div>
    </div>
  );
}
