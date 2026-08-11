import React from "react";
import TransferLocationMappingPage from "./TransferLocationMappingPage";

/** Manage Masters → Transfer Location Mapping → Place Mapping. */
export default function PlaceMapping() {
  return (
    <TransferLocationMappingPage
      masterType="PLACE"
      title="Place Mapping"
      masterLabel="Place"
    />
  );
}
