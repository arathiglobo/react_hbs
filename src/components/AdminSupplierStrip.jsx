import React, { useEffect, useState } from "react";
import { Badge } from "react-bootstrap";
import axiosInstance from "./AxiosInstance";
import { isAdminLogin, supplierDisplayName } from "../utils/supplierDisplay";

/**
 * Room page, admins only: which supplier this hotel came from and whether it is
 * mapped to other suppliers. Renders nothing for other logins, and the lookup
 * endpoint refuses them too.
 *
 * While "Mapped hotels as one hotel in search" is off (Automated Hotel Mapping),
 * search lists each supplier's hotel on its own, so neither the Mapped badge (with
 * its master / "also sold by" line) nor the Not mapped badge (with its note) is
 * shown: only the supplier name. The switch is read with the lookup;
 * if it cannot be read it counts as on, the same default the server uses.
 *
 * @param supplier supplier code of the hotel, such as GRN
 * @param hotelCode that supplier's hotel code
 */
export default function AdminSupplierStrip({ supplier, hotelCode }) {
  const admin = isAdminLogin();
  const [info, setInfo] = useState(null);
  const [searchMerged, setSearchMerged] = useState(true);

  useEffect(() => {
    if (!admin || !supplier || !hotelCode) return undefined;
    let cancelled = false;
    // Both answers are applied together, so the Mapped badge never flashes up
    // before the switch says it should stay hidden.
    Promise.allSettled([
      axiosInstance.get("/api/hotel-mapping/auto/lookup", { params: { supplier, hotelCode }, timeout: 20000 }),
      axiosInstance.get("/api/hotel-mapping/auto/search-mapping", { timeout: 20000 }),
    ]).then(([lookup, setting]) => {
      if (cancelled) return;
      setInfo(lookup.status === "fulfilled" ? lookup.value.data : null);
      setSearchMerged(setting.status !== "fulfilled" || setting.value?.data?.enabled !== false);
    });
    return () => {
      cancelled = true;
    };
  }, [admin, supplier, hotelCode]);

  if (!admin || !supplier) return null;

  const others = (info?.links || []).filter((l) => l.supplier !== String(supplier).toUpperCase());
  const otherNames = [...new Set(others.map((l) => supplierDisplayName(l.supplier)))];

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-2 small" aria-label="Supplier details for admins">
      <span className="text-muted">Supplier:</span>
      <Badge bg="light" text="dark" className="border">
        {supplierDisplayName(supplier)}
      </Badge>
      {info?.mapped && searchMerged && (
        <>
          <Badge bg="success">Mapped</Badge>
          <span className="text-muted">
            Master #{info.masterHotelId}
            {otherNames.length > 0 ? `, also sold by ${otherNames.join(", ")}` : ""}
          </span>
        </>
      )}
      {info && !info.mapped && searchMerged && (
        <>
          <Badge bg="secondary">Not mapped</Badge>
          {info.note && <span className="text-muted">{info.note}</span>}
        </>
      )}
    </div>
  );
}
