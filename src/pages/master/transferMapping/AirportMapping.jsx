import React from "react";
import TransferLocationMappingPage from "./TransferLocationMappingPage";

/** Manage Masters → Transfer Location Mapping → Airport Mapping. */
export default function AirportMapping() {
  return (
    <TransferLocationMappingPage
      masterType="AIRPORT"
      title="Airport Mapping"
      masterLabel="Airport"
      showCode
    />
  );
}
