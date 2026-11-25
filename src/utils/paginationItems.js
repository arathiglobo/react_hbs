// Page buttons for report tables: first 3, last 3, and current page ±1,
// with "..." for gaps. A gap of exactly one page shows that page instead.
//   getPaginationItems(24, 1)  -> 1 2 3 ... 22 23 24
//   getPaginationItems(24, 10) -> 1 2 3 ... 9 10 11 ... 22 23 24
// Numbers are page buttons; strings ("ellipsis-<n>") are ellipsis keys.
export function getPaginationItems(totalPages, currentPage) {
  const pages = new Set();
  for (let i = 1; i <= Math.min(3, totalPages); i++) pages.add(i);
  for (let i = Math.max(1, totalPages - 2); i <= totalPages; i++) pages.add(i);
  for (let i = currentPage - 1; i <= currentPage + 1; i++) {
    if (i >= 1 && i <= totalPages) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items = [];
  sorted.forEach((page, idx) => {
    const prev = sorted[idx - 1];
    if (prev !== undefined && page - prev === 2) items.push(prev + 1);
    else if (prev !== undefined && page - prev > 2) items.push(`ellipsis-${prev}`);
    items.push(page);
  });
  return items;
}
