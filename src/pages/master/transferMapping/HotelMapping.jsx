import React from "react";
import TransferLocationMappingPage from "./TransferLocationMappingPage";

/**
 * Manage Masters → Transfer Location Mapping → Hotel Mapping.
 *
 * Distinct from the existing supplier Hotel Mapping screen under Mapping
 * settings — that one maps hotel inventory across hotel suppliers, this one
 * translates a hotel into an i'way transfer location.
 */
export default function TransferHotelMapping() {
  return (
    <TransferLocationMappingPage
      masterType="HOTEL"
      title="Hotel Mapping (Transfer Locations)"
      masterLabel="Hotel"
    />
  );
}
