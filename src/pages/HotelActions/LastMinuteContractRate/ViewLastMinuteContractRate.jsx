/**
 * ViewLastMinuteContractRate — dedicated read-only view of a single
 * last-minute contract rate.
 *
 * Route: /hotel-actions/hotel/:id/last-minute-contract-rate/:rateId/view
 *
 * Deliberate clone of LastMinuteContractRateForm's fetch + render so
 * every field the operator sees in Edit also shows up here pre-
 * populated, just non-editable. Same endpoints (`/api/marketType`,
 * `/api/country`, `/api/seasonType`,
 * `/api/last-minute-contract-rate/{id}`,
 * `/api/last-minute-contract-rate/suggest/{hotelId}`,
 * `/api/hotelRoomDetailsController/{hotelId}`) and the same id-shape
 * fix that maps the backend's misspelt `rommCategoryId` onto
 * `hotelRoomcategoryId` so the per-cell rate lookup keys line up.
 *
 * View-only differences vs the form:
 *   - No "+ Add" / "+ Add More" buttons anywhere (Validity Periods,
 *     Terms & Conditions, Cancellation/Amendment/No-show policies,
 *     Payment Policies).
 *   - No per-row "✖" or trash button.
 *   - No Cancel/Update footer — a single Close at top-right and one
 *     at bottom-right.
 *   - Every Form.Control / Form.Select / react-select / Form.Check is
 *     disabled; onChange handlers are no-ops.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Spinner,
  Table,
  Alert,
  Badge,
} from "react-bootstrap";
import { FaArrowLeft } from "react-icons/fa";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function ViewLastMinuteContractRate() {
  const navigate = useNavigate();
  const { id: hotelId, rateId } = useParams();

  // State shape mirrors LastMinuteContractRateForm so we can paste its
  // hydration logic verbatim. The cell-confirm popover state isn't
  // needed (no editing) so it's dropped.
  const [formData, setFormData] = useState({
    seasonId: "",
    rateCode: "",
    marketType: [],
    excludeCountry: [],
    daySelection: "allDays",
    validityList: [{ validityFrom: "", validityTo: "" }],
    roomRates: [],
    isLive: true,
    checkInWindowDays: 2,
    markup: "",
    termsAndConditions: [""],
    cancellationPolicies: [
      { amount: "", amountType: "PERCENT", daysBeforeArrival: "" },
    ],
    amendmentPolicies: [
      { amount: "", amountType: "PERCENT", daysBeforeArrival: "" },
    ],
    noShowPolicies: [
      { amount: "", amountType: "PERCENT", daysBeforeArrival: "" },
    ],
    paymentPolicies: [""],
  });

  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [seasonTypes, setSeasonTypes] = useState([]);
  // suggestions keyed by `${categoryId}|${typeId}|${occId}` → suggestion
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);

  // Safely parse the markup field — handles "", ".", NaN.
  const parseMarkup = (val) => {
    if (!val || val === ".") return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  // 1) Dropdowns (same as Edit). We don't strictly need them all here
  //    (the saved Market Type already carries its ids), but keeping the
  //    fetch matches Edit's pipeline 1:1 and avoids any "All" / id
  //    resolution surprises.
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [marketRes, countryRes, seasonTypeRes] = await Promise.all([
          axiosInstance.get("/api/marketType"),
          axiosInstance.get("/api/country"),
          axiosInstance.get("/api/seasonType"),
        ]);
        const marketsWithAll = [
          { marketTypeId: 100, name: "All" },
          ...(marketRes.data || []),
        ];
        setMarkets(marketsWithAll);
        setCountries(countryRes.data || []);
        setSeasonTypes(seasonTypeRes.data || []);
      } catch {
        toast.error("Failed to load dropdown data");
      }
    };
    fetchDropdowns();
  }, []);

  // 1b) Re-resolve `#<id>` placeholder labels for selected Market Type /
  //     Exclude Nationality once the master lists arrive. Same cosmetic
  //     pass the form does in Edit mode.
  useEffect(() => {
    if (markets.length === 0 && countries.length === 0) return;
    setFormData((f) => ({
      ...f,
      marketType: f.marketType.map((m) => {
        const found = markets.find((x) => x.marketTypeId === m.value);
        return found ? { value: m.value, label: found.name } : m;
      }),
      excludeCountry: f.excludeCountry.map((c) => {
        const found = countries.find((x) => x.id === c.value);
        return found
          ? { value: c.value, label: `${found.name} (${found.marketType})` }
          : c;
      }),
    }));
  }, [markets, countries]);

  // 2) Rooms + suggestions + existing record. Same call list as Edit
  //    and same `rommCategoryId` → `hotelRoomcategoryId` translation
  //    so the rate lookups don't miss.
  useEffect(() => {
    const init = async () => {
      if (!hotelId || !rateId) return;
      try {
        setRoomLoading(true);
        setLoading(true);
        const [roomsRes, suggestRes, existingRes] = await Promise.all([
          axiosInstance.get(`/api/hotelRoomDetailsController/${hotelId}`),
          axiosInstance.get(`/api/last-minute-contract-rate/suggest/${hotelId}`),
          axiosInstance.get(`/api/last-minute-contract-rate/${rateId}`),
        ]);

        const mapped = (roomsRes.data || []).map((room) => {
          const uniqOcc = (room.occupancyDetailsDTOs || []).reduce(
            (acc, cur) => {
              const exists = acc.find(
                (x) =>
                  x.id === cur.id && x.occupanyType === cur.occupanyType
              );
              if (!exists) acc.push(cur);
              return acc;
            },
            []
          );
          return {
            hotelRoomcategoryId:
              room.rommCategoryId || room.hotelRoomcategoryId,
            roomCategory: room.roomCategory,
            occupancyDetailsDTOs: uniqOcc,
            roomTypeDetailsDTOs: room.roomTypeDetailsDTOs || [],
          };
        });
        setHotelRooms(mapped);

        const map = {};
        (suggestRes.data || []).forEach((s) => {
          const key = `${s.hotelRoomcategoryId}|${s.hotelRoomtypeId}|${s.ocuppancytypeId}`;
          map[key] = s;
        });
        setSuggestions(map);

        if (existingRes?.data) {
          const e = existingRes.data;
          setFormData({
            seasonId: e.seasonId ?? "",
            rateCode: e.rateCode ?? "",
            marketType: (e.markeType || []).map((mid) => ({
              value: mid,
              label: `#${mid}`,
            })),
            excludeCountry: (e.excludeCountry || []).map((cid) => ({
              value: cid,
              label: `#${cid}`,
            })),
            daySelection: e.allDays
              ? "allDays"
              : e.weekDay
              ? "weekDays"
              : e.weekEndDay
              ? "weekendDays"
              : "allDays",
            validityList:
              e.contractRateValidityDTO &&
              e.contractRateValidityDTO.length > 0
                ? e.contractRateValidityDTO.map((v) => ({
                    validityFrom: v.validityFrom
                      ? String(v.validityFrom).slice(0, 16)
                      : "",
                    validityTo: v.validityTo
                      ? String(v.validityTo).slice(0, 16)
                      : "",
                  }))
                : [{ validityFrom: "", validityTo: "" }],
            roomRates: (e.contractRateRoomDTO || []).map((r) => ({
              hotelRoomcategoryId: String(r.hotelRoomcategoryId),
              hotelRoomtypeId: String(r.hotelRoomtypeId),
              ocuppancytypeId: String(r.ocuppancytypeId),
              rate: r.rate ?? 0,
              adultRate: r.adultRate ?? 0,
              childRate: r.childRate ?? 0,
              extraBed: !!r.extraBed,
              meal: !!r.meal,
              refundable:
                r.refundable === null || r.refundable === undefined
                  ? true
                  : !!r.refundable,
            })),
            isLive: !!e.isLive,
            checkInWindowDays:
              e.checkInWindowDays != null ? Number(e.checkInWindowDays) : 2,
            markup: e.markup ?? "",
            termsAndConditions:
              e.termsAndConditions && e.termsAndConditions.length > 0
                ? e.termsAndConditions
                : [""],
            cancellationPolicies:
              e.cancellationPolicies && e.cancellationPolicies.length > 0
                ? e.cancellationPolicies
                : [
                    {
                      amount: "",
                      amountType: "PERCENT",
                      daysBeforeArrival: "",
                    },
                  ],
            amendmentPolicies:
              e.amendmentPolicies && e.amendmentPolicies.length > 0
                ? e.amendmentPolicies
                : [
                    {
                      amount: "",
                      amountType: "PERCENT",
                      daysBeforeArrival: "",
                    },
                  ],
            noShowPolicies:
              e.noShowPolicies && e.noShowPolicies.length > 0
                ? e.noShowPolicies
                : [
                    {
                      amount: "",
                      amountType: "PERCENT",
                      daysBeforeArrival: "",
                    },
                  ],
            paymentPolicies:
              e.paymentPolicies && e.paymentPolicies.length > 0
                ? e.paymentPolicies
                : [""],
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load form data");
      } finally {
        setRoomLoading(false);
        setLoading(false);
      }
    };
    init();
  }, [hotelId, rateId]);

  // Cell lookup mirrors the form's helper — used by the rate table.
  const cellValue = (catId, occId, typeId, field) =>
    formData.roomRates.find(
      (r) =>
        r.hotelRoomcategoryId === String(catId) &&
        r.ocuppancytypeId === String(occId) &&
        r.hotelRoomtypeId === String(typeId)
    )?.[field];

  // View-mode policy renderers — no add/remove buttons, fields
  // disabled. Long entries (Terms & Conditions, Payment Policies)
  // used to render inside a fixed-height textarea and got clipped
  // behind a scrollbar. We now render them as a div styled to look
  // exactly like a disabled Form.Control so the box auto-grows
  // vertically to fit the full text — no scroll, nothing hidden.
  const renderTextPoliciesView = (title, field) => {
    const items = (formData[field] || []).filter((s) => String(s || "").trim());
    if (items.length === 0) return null;
    return (
      <div className="border-top pt-4 mt-4">
        <h6 className="fw-bold text-primary mb-3">{title}</h6>
        {items.map((item, index) => (
          <Row key={`${field}-${index}`} className="align-items-start mb-2 g-2">
            <Col md={12}>
              <div
                className="form-control bg-light"
                style={{
                  // Mirror Bootstrap's disabled Form.Control look so
                  // this slots cleanly next to the other read-only
                  // inputs on the page.
                  height: "auto",
                  minHeight: "calc(1.5em + 0.75rem + 2px)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#212529",
                  cursor: "default",
                }}
              >
                {item}
              </div>
            </Col>
          </Row>
        ))}
      </div>
    );
  };

  const renderRulePoliciesView = (title, field, label) => {
    const items = (formData[field] || []).filter(
      (row) => row.amount !== "" || row.daysBeforeArrival !== ""
    );
    if (items.length === 0) return null;
    return (
      <div className="border-top pt-4 mt-4">
        <h6 className="fw-bold text-primary mb-3">{title}</h6>
        {items.map((item, index) => (
          <Row
            key={`${field}-${index}`}
            className="align-items-center mb-3 bg-light p-3 rounded-3"
          >
            <Col md={12}>
              <div className="d-flex align-items-center flex-wrap gap-2">
                <span className="fw-semibold small">{label} of</span>
                <Form.Control
                  type="number"
                  style={{ width: "120px" }}
                  value={item.amount ?? ""}
                  disabled
                  readOnly
                  className="bg-white"
                />
                <Form.Select
                  style={{ width: "110px" }}
                  value={item.amountType || "PERCENT"}
                  disabled
                  className="bg-white"
                >
                  <option value="PERCENT">%</option>
                  <option value="AMOUNT">Amount</option>
                </Form.Select>
                <span className="text-muted small">
                  if applicable less than
                </span>
                <Form.Control
                  type="number"
                  style={{ width: "90px" }}
                  value={item.daysBeforeArrival ?? ""}
                  disabled
                  readOnly
                  className="bg-white"
                />
                <span className="text-muted small">days before arrival</span>
              </div>
            </Col>
          </Row>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light d-flex flex-column">
        <Topbar />
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4">
            <div
              className="d-flex justify-content-center align-items-center"
              style={{ height: "50vh" }}
            >
              <Spinner animation="border" variant="primary" />
              <span className="ms-3">Loading rate…</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Selected season label so the Season input shows the human name
  // rather than the bare id.
  const selectedSeasonName =
    seasonTypes.find(
      (s) => String(s.seasonTypeId) === String(formData.seasonId)
    )?.season || "";

  // Discount percentage display matches the form's header pill. We
  // surface it next to the rate table header but never recalculate
  // anything — values come from the saved record.
  const discountPct =
    formData.markup === "" ||
    formData.markup === undefined ||
    formData.markup === null
      ? 10
      : parseMarkup(formData.markup);
  const maxAllowedFactor = 1.0 - discountPct / 100.0;

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Container fluid>
            {/* Header — Back / title + hotel badge / Close. No Update. */}
           <div className="d-flex justify-content-between align-items-center mb-4">
  {/* Left */}
  <Button variant="outline-secondary" onClick={() => navigate(-1)}>
    <FaArrowLeft className="me-2" /> Back
  </Button>

  {/* Center */}
  <h4 className="fw-semibold text-dark mb-0">
    View Last Minute
  </h4>

  {/* Right */}
  <div className="d-flex align-items-center">
    <HotelTitleBadge hotelId={hotelId} />
  </div>
</div>

            <Card className="shadow-sm border-0 rounded-4 p-4">
              <Alert
                variant="info"
                className="py-2 mb-3"
                style={{ fontSize: "0.85rem" }}
              >
                Last-minute rates were saved as <strong>{discountPct}% off</strong>{" "}
                the matching normal contract rate.
              </Alert>

              {/* Top form — same 4-up layout as Edit, all disabled. */}
              <Row className="mb-4 g-4">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Season</Form.Label>
                    <Form.Control
                      value={selectedSeasonName}
                      disabled
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Rate Code</Form.Label>
                    <Form.Control
                      value={formData.rateCode}
                      disabled
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Market Type</Form.Label>
                    <Select
                      isMulti
                      isDisabled
                      options={markets.map((m) => ({
                        value: m.marketTypeId,
                        label: m.name,
                      }))}
                      value={formData.marketType}
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Exclude Nationality</Form.Label>
                    <Select
                      isMulti
                      isDisabled
                      options={countries.map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.marketType})`,
                      }))}
                      value={formData.excludeCountry}
                      placeholder="Select..."
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Check-in Window (Days)</Form.Label>
                    <Form.Control
                      type="number"
                      value={formData.checkInWindowDays ?? ""}
                      disabled
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Markup Percentage</Form.Label>
                    <Form.Control
                      value={formData.markup ?? ""}
                      disabled
                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Day Selection — radios disabled. */}
              <Row className="mb-4">
                <Col md={12}>
                  <Card className="p-3 bg-light border-0 rounded-3">
                    <h6 className="fw-bold text-primary mb-3">Day Selection</h6>
                    <Form.Group>
                      <div className="d-flex gap-4">
                        {[
                          { id: "allDays", label: "All Days" },
                          { id: "weekDays", label: "Week Days" },
                          { id: "weekendDays", label: "Weekend Days" },
                        ].map((d) => (
                          <Form.Check
                            key={d.id}
                            type="radio"
                            id={`lm-view-${d.id}`}
                            name="lm-view-daySelection"
                            label={d.label}
                            value={d.id}
                            checked={formData.daySelection === d.id}
                            disabled
                            readOnly
                          />
                        ))}
                      </div>
                    </Form.Group>
                  </Card>
                </Col>
              </Row>

              {/* Validity Periods — no "+ Add", no "✖". */}
              <Card className="p-3 bg-light border-0 mb-4 rounded-3">
                <h6 className="fw-bold text-primary mb-3">Validity Periods</h6>
                {formData.validityList.length === 0 ? (
                  <div className="text-muted small">No validity periods.</div>
                ) : (
                  formData.validityList.map((v, idx) => (
                    <Row key={idx} className="align-items-end mb-2">
                      <Col md={4}>
                        <Form.Control
                          type="datetime-local"
                          value={v.validityFrom || ""}
                          disabled
                          readOnly
                          className="bg-white"
                        />
                      </Col>
                      <Col md={4}>
                        <Form.Control
                          type="datetime-local"
                          value={v.validityTo || ""}
                          disabled
                          readOnly
                          className="bg-white"
                        />
                      </Col>
                    </Row>
                  ))
                )}
              </Card>

              {/* Last Minute Rate Details — same shape as Edit, just disabled. */}
              <Card className="p-3 bg-light border-0 rounded-3">
                <h6 className="fw-bold mb-3 text-primary">
                  Last Minute Rate Details ({discountPct}% off normal)
                </h6>
                {roomLoading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" />
                  </div>
                ) : (
                  hotelRooms.map((room) => {
                    const current = formData.roomRates.find(
                      (r) =>
                        r.hotelRoomcategoryId ===
                        String(room.hotelRoomcategoryId)
                    );
                    const isRefundable = current?.refundable === true;
                    const isNonRefundable = current?.refundable === false;
                    const groupName = `lm-view-refundable-${room.hotelRoomcategoryId}`;
                    return (
                      <div
                        key={room.hotelRoomcategoryId}
                        className="border rounded-4 bg-white p-3 mb-4 shadow-sm"
                      >
                        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                          <span className="fw-semibold text-uppercase">
                            {room.roomCategory}
                          </span>
                          <div className="d-flex align-items-center gap-3">
                            <Form.Check
                              type="radio"
                              inline
                              name={groupName}
                              id={`${groupName}-yes`}
                              label="Refundable"
                              checked={isRefundable}
                              disabled
                              readOnly
                            />
                            <Form.Check
                              type="radio"
                              inline
                              name={groupName}
                              id={`${groupName}-no`}
                              label="Non Refundable"
                              checked={isNonRefundable}
                              disabled
                              readOnly
                            />
                          </div>
                        </div>

                        <Table bordered hover responsive size="sm">
                          <thead className="table-light">
                            <tr>
                              <th>Occupancy</th>
                              <th>Room Type</th>
                              <th>
                                Rate{" "}
                                <small className="text-muted">
                                  (normal → -{discountPct}%)
                                </small>
                              </th>
                              <th>Extra Adult</th>
                              <th>Extra Child</th>
                            </tr>
                          </thead>
                          <tbody>
                            {room.occupancyDetailsDTOs.length > 0 &&
                            room.roomTypeDetailsDTOs.length > 0 ? (
                              room.occupancyDetailsDTOs.map((occ) =>
                                room.roomTypeDetailsDTOs.map((rt) => {
                                  const key = `${room.hotelRoomcategoryId}|${rt.roomTypeId}|${occ.id}`;
                                  const s = suggestions[key];
                                  const cells = [
                                    {
                                      field: "rate",
                                      normal: s?.normalRate,
                                      maxVal:
                                        s?.normalRate != null
                                          ? Math.round(
                                              s.normalRate *
                                                maxAllowedFactor *
                                                100
                                            ) / 100
                                          : undefined,
                                    },
                                    {
                                      field: "adultRate",
                                      normal: s?.normalAdultRate,
                                      maxVal:
                                        s?.normalAdultRate != null
                                          ? Math.round(
                                              s.normalAdultRate *
                                                maxAllowedFactor *
                                                100
                                            ) / 100
                                          : undefined,
                                    },
                                    {
                                      field: "childRate",
                                      normal: s?.normalChildRate,
                                      maxVal:
                                        s?.normalChildRate != null
                                          ? Math.round(
                                              s.normalChildRate *
                                                maxAllowedFactor *
                                                100
                                            ) / 100
                                          : undefined,
                                    },
                                  ];
                                  return (
                                    <tr key={`${occ.id}-${rt.roomTypeId}`}>
                                      <td>{occ.occupanyType}</td>
                                      <td>{rt.roomTypeName}</td>
                                      {cells.map(({ field, normal, maxVal }) => {
                                        const v = cellValue(
                                          room.hotelRoomcategoryId,
                                          occ.id,
                                          rt.roomTypeId,
                                          field
                                        );
                                        return (
                                          <td
                                            key={field}
                                            style={{ minWidth: 130 }}
                                          >
                                            <Form.Control
                                              type="number"
                                              value={
                                                v !== undefined && v !== null
                                                  ? v
                                                  : ""
                                              }
                                              disabled
                                              readOnly
                                              className="bg-light"
                                            />
                                            {normal != null && (
                                              <div
                                                style={{ fontSize: "0.7rem" }}
                                                className="mt-1"
                                              >
                                                <Badge
                                                  bg="light"
                                                  text="dark"
                                                  className="me-1"
                                                >
                                                  Normal:{" "}
                                                  {Number(normal).toFixed(2)}
                                                </Badge>
                                                {maxVal != null && (
                                                  <Badge bg="success">
                                                    Max:{" "}
                                                    {Number(maxVal).toFixed(2)}
                                                  </Badge>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })
                              )
                            ) : (
                              <tr>
                                <td
                                  colSpan="5"
                                  className="text-center text-muted py-3"
                                >
                                  No room types or occupancy details available
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </Table>
                      </div>
                    );
                  })
                )}
              </Card>

              {/* Terms & Policies — render only the sections that have
                  content. No "Add More", no trash buttons. */}
              <Card className="p-3 bg-white border-0 rounded-3 mt-4 shadow-sm">
                <h6 className="fw-bold mb-1 text-primary">
                  Terms &amp; Conditions and Policies
                </h6>
                <p className="text-muted small mb-0">
                  These Last Minute-specific policies are shown before booking
                  confirmation.
                </p>

                {renderTextPoliciesView(
                  "Terms & Conditions",
                  "termsAndConditions"
                )}
                {renderRulePoliciesView(
                  "Cancellation Policies",
                  "cancellationPolicies",
                  "Cancellation fee"
                )}
                {renderRulePoliciesView(
                  "Amendment Policies",
                  "amendmentPolicies",
                  "Amendment fee"
                )}
                {renderRulePoliciesView(
                  "No-show Policies",
                  "noShowPolicies",
                  "No-show fee"
                )}
                {renderTextPoliciesView("Payment Policies", "paymentPolicies")}
              </Card>

              {/* Footer — single Close. */}
              <div className="d-flex justify-content-end mt-4">
                <Button variant="secondary" onClick={() => navigate(-1)}>
                  Close
                </Button>
              </div>
            </Card>
          </Container>
        </main>
      </div>
    </div>
  );
}
