// Bootstrap 5's .form-select chevron as an inline style, for applying to
// Form.Control-based searchable dropdown filters (Supplier, Agent,
// DestinationCity, ...) so they carry the same small down arrow as native
// Form.Select controls. Spread onto the input via style={chevronStyle}.
const chevronStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.75rem center",
  backgroundSize: "16px 12px",
  paddingRight: "2.25rem",
};

export default chevronStyle;
