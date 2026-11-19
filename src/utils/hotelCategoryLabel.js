// The hotel category as the Hotel Wise / Monthly Wise reports show it.
// Rows carry the category id in hotelCategory (what the Hotel Category filter
// sends) and its name in hotelCategoryName (what that dropdown shows).
// A bare number gets "Star" ("3" -> "3 Star"); the id shows only without a name.
export const hotelCategoryLabel = (row) => {
  const name = String(row?.hotelCategoryName ?? "").trim();
  if (name) return /^\d+$/.test(name) ? `${name} Star` : name;
  const id = row?.hotelCategory;
  return id === null || id === undefined ? "" : String(id);
};
