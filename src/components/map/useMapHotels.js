import { useEffect, useRef, useState } from "react";
import axiosInstance from "../AxiosInstance";
import { mapHotelRow } from "../../utils/hotelSearchResults";
import { hotelNumericId, idBatches } from "../../utils/hotelResultFilters";

/**
 * The most hotels the map asks for. The list shows 10 a page, but the map shows
 * every hotel that passes the filters, in the list's sort order, up to this.
 */
export const MAP_MAX_HOTELS = 1000;

/** How often the map asks again while suppliers are still answering. */
export const MAP_REFRESH_MS = 5000;

/** Ids per /api/hotel-feature-flags request, to keep the URL short. */
const FEATURE_FLAG_BATCH = 150;

/**
 * Every hotel of the search that the server's filters let through (all pages),
 * for the map. The page applies its own filters on top (filterHotelResults),
 * exactly as it does for the list.
 *
 *   enabled        — false while the map is closed: nothing is fetched
 *   searchId       — the running search
 *   query          — resultsQueryParams(...) without page or size
 *   searching      — true while suppliers are still answering: asks again
 *                    every MAP_REFRESH_MS, so the map grows with the list
 *   needDealFlags  — true when an Available Deals box is ticked: fetches the
 *                    feature flags for the map's hotels, not only the page's
 *   twentyFourHour — { date, time } on the 24-hour search once it has
 *                    finished: probes the map's hotels for eligibility
 *
 * Returns { hotels, totalResults, loading, failed, featureFlagsMap,
 * twentyFourHourMap }. Replies to an older query or search are dropped.
 */
export default function useMapHotels({
  enabled,
  searchId,
  query,
  searching,
  needDealFlags,
  twentyFourHour,
}) {
  const [hotels, setHotels] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [featureFlagsMap, setFeatureFlagsMap] = useState({});
  const [twentyFourHourMap, setTwentyFourHourMap] = useState({});
  const seqRef = useRef(0);
  const queryKey = JSON.stringify(query || {});

  // A new search starts empty.
  useEffect(() => {
    setHotels([]);
    setTotalResults(0);
    setFeatureFlagsMap({});
    setTwentyFourHourMap({});
  }, [searchId]);

  // The hotels: at once when opened or when a filter changes, then again
  // every few seconds while the search is running, and once more when it ends.
  useEffect(() => {
    if (!enabled || !searchId) return undefined;
    let cancelled = false;
    let timer = null;

    const load = async (quiet) => {
      const mySeq = ++seqRef.current;
      if (!quiet) setLoading(true);
      try {
        const res = await axiosInstance.get(
          `/api/hotel-search/results/${searchId}`,
          {
            params: {
              ...JSON.parse(queryKey),
              page: 0,
              pageSize: undefined,
              size: MAP_MAX_HOTELS,
            },
          },
        );
        if (cancelled || mySeq !== seqRef.current) return;
        const data = res?.data || {};
        const rows = Array.isArray(data.result) ? data.result : [];
        setHotels(rows.map((row, i) => mapHotelRow(row, searchId, i, data)));
        setTotalResults(Number(data.totalResults) || rows.length);
        setFailed(false);
      } catch (err) {
        if (cancelled || mySeq !== seqRef.current) return;
        console.warn("Map hotels fetch failed:", err?.message);
        setFailed(true);
      } finally {
        if (!cancelled && mySeq === seqRef.current && !quiet) setLoading(false);
      }
    };

    load(false);
    if (searching) {
      const tick = () => {
        timer = setTimeout(async () => {
          await load(true);
          if (!cancelled) tick();
        }, MAP_REFRESH_MS);
      };
      tick();
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // A reply still on its way belongs to the old query.
      seqRef.current += 1;
      setLoading(false);
    };
  }, [enabled, searchId, queryKey, searching]);

  // Deal flags for the map's hotels, only while a deal box is ticked.
  const idsCsv = needDealFlags
    ? Array.from(
        new Set(hotels.map((h) => hotelNumericId(h)).filter(Boolean)),
      )
        .sort((a, b) => Number(a) - Number(b))
        .join(",")
    : "";
  useEffect(() => {
    if (!enabled || !idsCsv) return undefined;
    let cancelled = false;
    Promise.all(
      idBatches(idsCsv, FEATURE_FLAG_BATCH).map((csv) =>
        axiosInstance
          .get(`/api/hotel-feature-flags?ids=${csv}`)
          .then((res) => res?.data?.hotels || {})
          .catch(() => ({})),
      ),
    ).then((parts) => {
      if (!cancelled) setFeatureFlagsMap(Object.assign({}, ...parts));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, idsCsv]);

  // 24-hour eligibility for the map's hotels, once the search has finished.
  const probeDate = twentyFourHour?.date || "";
  const probeTime = twentyFourHour?.time || "";
  const probeIdsCsv =
    probeDate && probeTime
      ? Array.from(
          new Set(
            hotels
              .map((h) => {
                const m = String(h.hotelCode || "").match(/(\d+)$/);
                return m ? Number(m[1]) : NaN;
              })
              .filter((n) => Number.isFinite(n) && n > 0),
          ),
        )
          .sort((a, b) => a - b)
          .join(",")
      : "";
  useEffect(() => {
    if (!enabled || !probeIdsCsv) return undefined;
    let cancelled = false;
    axiosInstance
      .post("/api/24-hour-checkin/probe-bulk", {
        hotelIds: probeIdsCsv.split(",").map(Number),
        date: probeDate,
        time: probeTime,
      })
      .then((res) => {
        if (!cancelled) setTwentyFourHourMap(res?.data || {});
      })
      .catch(() => {
        if (!cancelled) setTwentyFourHourMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, probeIdsCsv, probeDate, probeTime]);

  return {
    hotels,
    totalResults,
    loading,
    failed,
    featureFlagsMap,
    twentyFourHourMap,
  };
}
