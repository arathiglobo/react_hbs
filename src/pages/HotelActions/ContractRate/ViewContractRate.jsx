/**
 * ViewContractRate — dedicated read-only view of a single contract rate.
 *
 * Route: /hotel-actions/hotel/:id/contract-rate/:contractRateId/view
 *
 * This screen is a deliberate clone of EditContractRate's fetch + render
 * pipeline so every field the operator sees in Edit also shows up here,
 * pre-populated, just non-editable. Concretely we:
 *
 *   - Call the same endpoints (/api/marketType, /api/country,
 *     /api/seasonType, /api/hotelContractRate/{id},
 *     /api/hotelRoomDetailsController/{hotelId}).
 *   - Apply the same id-shape fixes — notably mapping the backend's
 *     misspelt `rommCategoryId` onto `hotelRoomcategoryId` so the per-
 *     cell rate lookup keys line up.
 *   - Keep the exact same layout (Season, Rate Code, Market Type,
 *     Exclude Nationality, Day Selection, Validity Periods, Contract
 *     Rate Details with Refundable + occupancy × roomType matrix).
 *
 * The view-only differences vs Edit:
 *   - No "+ Add" button on the Validity Periods header.
 *   - No per-row "✖" remove button.
 *   - No Cancel/Update footer — a single Close in the header.
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
} from "react-bootstrap";
import { FaArrowLeft } from "react-icons/fa";
import Select from "react-select";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/TopBar";
import HotelTitleBadge from "../../../components/HotelTitleBadge";
import axiosInstance from "../../../components/AxiosInstance";
import { toast } from "react-hot-toast";

export default function ViewContractRate() {
  const navigate = useNavigate();
  const { id, contractRateId } = useParams(); // id = hotelId

  // State mirrors EditContractRate so we can paste its mapping in
  // verbatim. We don't need cell-confirm popover state — there's no
  // editing — so that's the only thing dropped.
  const [formData, setFormData] = useState({
    seasonId: "",
    rateCode: "",
    marketType: [],
    excludeCountry: [],
    daySelection: "allDays",
    validityList: [{ validityFrom: "", validityTo: "" }],
    roomRates: [],
  });

  const [markets, setMarkets] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [seasonTypes, setSeasonTypes] = useState([]);
  const [fetchingData, setFetchingData] = useState(true);

  // 1) Dropdown master data — same calls as the edit screen, and the
  //    same "All" pseudo-entry prepended so the saved value (id 100)
  //    resolves to a label.
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
        setFilteredCountries(countryRes.data || []);
        setSeasonTypes(seasonTypeRes.data || []);
      } catch {
        toast.error("Failed to load dropdown data");
      }
    };
    fetchDropdowns();
  }, []);

  // 2) Contract rate fetch — mapping mirrors EditContractRate so the
  //    on-screen population is identical. We keep the full roomRates
  //    object (including mealType / hotelMealId / meal / extraBed) so
  //    the lookup-by-keys still finds the cell even though we don't
  //    display those extras.
  useEffect(() => {
    const fetchContractRateData = async () => {
      if (!contractRateId || markets.length === 0 || countries.length === 0)
        return;
      try {
        setFetchingData(true);
        const res = await axiosInstance.get(
          `/api/hotelContractRate/${contractRateId}`
        );

        if (res.data) {
          const data = res.data;

          const selectedMarkets =
            data.markeType
              ?.map((apiMarket) => {
                if (typeof apiMarket === "number") {
                  const matchingMarket = markets.find(
                    (m) => m.marketTypeId === apiMarket
                  );
                  return {
                    value: apiMarket,
                    label: matchingMarket?.name || `Market ${apiMarket}`,
                  };
                }
                const matchingMarket = markets.find(
                  (m) =>
                    m.marketTypeId === apiMarket.marketTypeId ||
                    m.marketTypeId === apiMarket.id
                );
                return {
                  value: apiMarket.marketTypeId || apiMarket.id,
                  label:
                    apiMarket.name ||
                    matchingMarket?.name ||
                    "Unknown Market",
                };
              })
              .filter((m) => m.label !== "Unknown Market") || [];

          const selectedCountries =
            data.excludeCountry
              ?.map((apiCountry) => {
                const matchingCountry = countries.find(
                  (c) => c.id === apiCountry.id
                );
                return {
                  value: apiCountry.id,
                  label: `${
                    apiCountry.name ||
                    matchingCountry?.name ||
                    "Unknown Country"
                  } (${
                    apiCountry.marketType || matchingCountry?.marketType || ""
                  })`,
                };
              })
              .filter((c) => !c.label.includes("Unknown Country")) || [];

          let daySelection = "allDays";
          if (data.allDays === 1) daySelection = "allDays";
          else if (data.weekDay === 1) daySelection = "weekDays";
          else if (data.weekEndDay === 1) daySelection = "weekendDays";

          const validityList = data.contractRateValidityDTO?.map((v) => ({
            validityFrom: v.validityFrom ? v.validityFrom.substring(0, 16) : "",
            validityTo: v.validityTo ? v.validityTo.substring(0, 16) : "",
          })) || [{ validityFrom: "", validityTo: "" }];

          const roomRates =
            data.contractRateRoomDTO?.map((room) => ({
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
              refundable:
                room.refundable === null || room.refundable === undefined
                  ? true
                  : Boolean(room.refundable),
            })) || [];

          setFormData({
            seasonId: String(data.seasonId || ""),
            rateCode: data.rateCode || "",
            marketType: selectedMarkets,
            excludeCountry: selectedCountries,
            daySelection,
            validityList,
            roomRates,
          });

          // Mirror Edit: narrow the country dropdown to the selected
          // market(s) so the "Exclude Nationality" labels match.
          if (selectedMarkets.length > 0) {
            const selectedMarketIds = selectedMarkets.map((m) => m.value);
            const filtered = countries.filter((c) =>
              selectedMarketIds.includes(c.marketTypeId)
            );
            setFilteredCountries(filtered);
          }
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

  // 3) Hotel rooms — IMPORTANT: the backend emits the category id under
  //    the misspelt key `rommCategoryId`. EditContractRate normalises
  //    that onto `hotelRoomcategoryId`; we do the same here, otherwise
  //    every rate cell's lookup misses and the column renders blank.
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
            const uniqueOccupancy = room.occupancyDetailsDTOs.reduce(
              (acc, current) => {
                const existingIndex = acc.findIndex(
                  (item) =>
                    item.id === current.id &&
                    item.occupanyType === current.occupanyType
                );
                if (existingIndex === -1) acc.push(current);
                return acc;
              },
              []
            );
            return {
              hotelRoomcategoryId:
                room.rommCategoryId || room.hotelRoomcategoryId,
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

  // Selected season label — driven off seasonTypes so the Season input
  // shows the human name rather than the bare id.
  const selectedSeasonName =
    seasonTypes.find(
      (s) => String(s.seasonTypeId) === String(formData.seasonId)
    )?.season || "";

  if (fetchingData) {
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
            {/* Header — Back / title + hotel badge / Close. No Update. */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Button variant="outline-secondary" onClick={() => navigate(-1)}>
                <FaArrowLeft className="me-2" /> Back
              </Button>
              <h4 className="fw-semibold text-dark mb-0 d-flex align-items-center gap-2">
                View Contract Rate
                <HotelTitleBadge hotelId={id} />
              </h4>
              <Button variant="outline-secondary" style={{ visibility: "hidden" }} tabIndex={-1} aria-hidden="true">
                <FaArrowLeft className="me-2" /> Back
              </Button>
            </div>

            <Card className="shadow-sm border-0 rounded-4 p-4">
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
                      options={filteredCountries.map((c) => ({
                        value: c.id,
                        label: `${c.name} (${c.marketType})`,
                      }))}
                      value={formData.excludeCountry}
                      placeholder="Select..."
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Day Selection — radios disabled, the saved choice
                  stays highlighted because `checked` is still set. */}
              <Row className="mb-4">
                <Col md={12}>
                  <Card className="p-3 bg-light border-0 rounded-3">
                    <h6 className="fw-bold text-primary mb-3">
                      Day Selection
                    </h6>
                    <Form.Group>
                      <div className="d-flex gap-4">
                        <Form.Check
                          type="radio"
                          id="view-allDays"
                          name="view-daySelection"
                          label="All Days"
                          value="allDays"
                          checked={formData.daySelection === "allDays"}
                          disabled
                          readOnly
                        />
                        <Form.Check
                          type="radio"
                          id="view-weekDays"
                          name="view-daySelection"
                          label="Week Days"
                          value="weekDays"
                          checked={formData.daySelection === "weekDays"}
                          disabled
                          readOnly
                        />
                        <Form.Check
                          type="radio"
                          id="view-weekendDays"
                          name="view-daySelection"
                          label="Weekend Days"
                          value="weekendDays"
                          checked={formData.daySelection === "weekendDays"}
                          disabled
                          readOnly
                        />
                      </div>
                    </Form.Group>
                  </Card>
                </Col>
              </Row>

              {/* Validity Periods — no "+ Add" header button, no
                  per-row "✖". Just the populated date inputs. */}
              <Card className="p-3 bg-light border-0 mb-4 rounded-3">
                <h6 className="fw-bold text-primary mb-3">Validity Periods</h6>
                {formData.validityList.length === 0 ? (
                  <div className="text-muted small">No validity periods.</div>
                ) : (
                  formData.validityList.map((v, index) => (
                    <Row key={index} className="align-items-end mb-2">
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

              {/* Contract Rate Details — same per-category card shape
                  as Edit (Refundable / Non Refundable radios + the
                  occupancy × roomType rate matrix). All inputs are
                  disabled and rendered with the same lookup keys Edit
                  uses, so the populated rates display 1:1. */}
              <Card className="p-3 bg-light border-0 rounded-3">
                <h6 className="fw-bold mb-3 text-primary">
                  Contract Rate Details
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
                    const groupName = `view-refundable-${room.hotelRoomcategoryId}`;
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
                              <th>Rate</th>
                              <th>Extra Adult</th>
                              <th>Extra Child</th>
                            </tr>
                          </thead>
                          <tbody>
                            {room.occupancyDetailsDTOs.length > 0 &&
                            room.roomTypeDetailsDTOs.length > 0 ? (
                              room.occupancyDetailsDTOs.map((occ) =>
                                room.roomTypeDetailsDTOs.map((roomType) => {
                                  const cell = formData.roomRates.find(
                                    (r) =>
                                      r.hotelRoomcategoryId ===
                                        String(room.hotelRoomcategoryId) &&
                                      r.ocuppancytypeId === String(occ.id) &&
                                      r.hotelRoomtypeId ===
                                        String(roomType.roomTypeId)
                                  );
                                  return (
                                    <tr
                                      key={`${occ.id}-${roomType.roomTypeId}`}
                                    >
                                      <td>{occ.occupanyType}</td>
                                      <td>{roomType.roomTypeName}</td>
                                      {["rate", "adultRate", "childRate"].map(
                                        (field) => (
                                          <td key={field}>
                                            <Form.Control
                                              type="number"
                                              value={
                                                cell?.[field] !== undefined &&
                                                cell?.[field] !== null
                                                  ? cell[field]
                                                  : ""
                                              }
                                              disabled
                                              readOnly
                                              className="bg-light"
                                            />
                                          </td>
                                        )
                                      )}
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

              {/* Footer — single Close, no Update/Cancel. */}
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
