// Approximate lat/lng lookups for the "Explore on Map" preview on
// /new-booking/package-search. Packages only store a text arrive-place and
// arrive-country (see PackageSearchResponseDTO.arrivePlace / .arriveCountryName
// on the backend) — no master table in that chain carries coordinates, and
// this app does not call any third-party geocoding API. These tables are
// plain, public geographic facts (city/country centroids), used purely to
// place an "almost" pin — not a precise address lookup.
//
// CITY_CENTROIDS is checked first (keyed by lowercase place name) since it is
// far more precise than a whole-country centroid; COUNTRY_CENTROIDS is the
// fallback. Extend either table as new destinations come up — no code changes
// needed elsewhere.

export const CITY_CENTROIDS = {
  dubai: [25.2048, 55.2708],
  "abu dhabi": [24.4539, 54.3773],
  sharjah: [25.3463, 55.4209],
  ajman: [25.4052, 55.5136],
  fujairah: [25.1288, 56.3265],
  "ras al khaimah": [25.7895, 55.9432],
  doha: [25.2854, 51.531],
  muscat: [23.588, 58.3829],
  riyadh: [24.7136, 46.6753],
  jeddah: [21.4858, 39.1925],
  mecca: [21.3891, 39.8579],
  medina: [24.5247, 39.5692],
  manama: [26.2285, 50.586],
  "kuwait city": [29.3759, 47.9774],
  amman: [31.9454, 35.9284],
  beirut: [33.8938, 35.5018],
  cairo: [30.0444, 31.2357],
  "sharm el sheikh": [27.9158, 34.3299],
  hurghada: [27.2579, 33.8116],
  istanbul: [41.0082, 28.9784],
  antalya: [36.8969, 30.7133],
  cappadocia: [38.6431, 34.8289],
  london: [51.5072, -0.1276],
  paris: [48.8566, 2.3522],
  rome: [41.9028, 12.4964],
  venice: [45.4408, 12.3155],
  milan: [45.4642, 9.19],
  barcelona: [41.3874, 2.1686],
  madrid: [40.4168, -3.7038],
  amsterdam: [52.3676, 4.9041],
  zurich: [47.3769, 8.5417],
  geneva: [46.2044, 6.1432],
  vienna: [48.2082, 16.3738],
  prague: [50.0755, 14.4378],
  athens: [37.9838, 23.7275],
  santorini: [36.3932, 25.4615],
  bangkok: [13.7563, 100.5018],
  phuket: [7.8804, 98.3923],
  pattaya: [12.9236, 100.8825],
  singapore: [1.3521, 103.8198],
  "kuala lumpur": [3.139, 101.6869],
  langkawi: [6.35, 99.8],
  bali: [-8.3405, 115.092],
  denpasar: [-8.65, 115.2167],
  jakarta: [-6.2088, 106.8456],
  male: [4.1755, 73.5093],
  colombo: [6.9271, 79.8612],
  kandy: [7.2906, 80.6337],
  "hong kong": [22.3193, 114.1694],
  macau: [22.1987, 113.5439],
  tokyo: [35.6762, 139.6503],
  osaka: [34.6937, 135.5023],
  seoul: [37.5665, 126.978],
  beijing: [39.9042, 116.4074],
  shanghai: [31.2304, 121.4737],
  "new york": [40.7128, -74.006],
  "los angeles": [34.0522, -118.2437],
  "las vegas": [36.1699, -115.1398],
  orlando: [28.5383, -81.3792],
  miami: [25.7617, -80.1918],
  toronto: [43.6532, -79.3832],
  sydney: [-33.8688, 151.2093],
  melbourne: [-37.8136, 144.9631],
  auckland: [-36.8485, 174.7633],
  mumbai: [19.076, 72.8777],
  delhi: [28.7041, 77.1025],
  "new delhi": [28.6139, 77.209],
  goa: [15.2993, 74.124],
  kochi: [9.9312, 76.2673],
  kerala: [10.8505, 76.2711],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  hyderabad: [17.385, 78.4867],
  jaipur: [26.9124, 75.7873],
  agra: [27.1767, 78.0081],
  udaipur: [24.5854, 73.7125],
  shimla: [31.1048, 77.1734],
  manali: [32.2432, 77.1892],
  kathmandu: [27.7172, 85.324],
  dhaka: [23.8103, 90.4125],
  johannesburg: [-26.2041, 28.0473],
  "cape town": [-33.9249, 18.4241],
  nairobi: [-1.2921, 36.8219],
  zanzibar: [-6.1357, 39.3621],
  mauritius: [-20.3484, 57.5522],
  seychelles: [-4.6796, 55.492],
  "abu dhabi city": [24.4539, 54.3773],
};

export const COUNTRY_CENTROIDS = {
  "united arab emirates": [23.4241, 53.8478],
  "saudi arabia": [23.8859, 45.0792],
  qatar: [25.3548, 51.1839],
  oman: [21.4735, 55.9754],
  bahrain: [26.0667, 50.5577],
  kuwait: [29.3117, 47.4818],
  jordan: [30.5852, 36.2384],
  lebanon: [33.8547, 35.8623],
  egypt: [26.8206, 30.8025],
  turkey: [38.9637, 35.2433],
  "united kingdom": [55.3781, -3.436],
  france: [46.6034, 1.8883],
  italy: [41.8719, 12.5674],
  spain: [40.4637, -3.7492],
  germany: [51.1657, 10.4515],
  netherlands: [52.1326, 5.2913],
  switzerland: [46.8182, 8.2275],
  austria: [47.5162, 14.5501],
  "czech republic": [49.8175, 15.473],
  greece: [39.0742, 21.8243],
  portugal: [39.3999, -8.2245],
  ireland: [53.4129, -8.2439],
  thailand: [15.87, 100.9925],
  singapore: [1.3521, 103.8198],
  malaysia: [4.2105, 101.9758],
  indonesia: [-0.7893, 113.9213],
  vietnam: [14.0583, 108.2772],
  philippines: [12.8797, 121.774],
  maldives: [3.2028, 73.2207],
  "sri lanka": [7.8731, 80.7718],
  "hong kong": [22.3193, 114.1694],
  japan: [36.2048, 138.2529],
  "south korea": [35.9078, 127.7669],
  china: [35.8617, 104.1954],
  "united states": [37.0902, -95.7129],
  "united states of america": [37.0902, -95.7129],
  usa: [37.0902, -95.7129],
  canada: [56.1304, -106.3468],
  mexico: [23.6345, -102.5528],
  brazil: [-14.235, -51.9253],
  australia: [-25.2744, 133.7751],
  "new zealand": [-40.9006, 174.886],
  india: [20.5937, 78.9629],
  nepal: [28.3949, 84.124],
  bangladesh: [23.685, 90.3563],
  pakistan: [30.3753, 69.3451],
  "south africa": [-30.5595, 22.9375],
  kenya: [-0.0236, 37.9062],
  tanzania: [-6.369, 34.8888],
  mauritius: [-20.3484, 57.5522],
  seychelles: [-4.6796, 55.492],
  morocco: [31.7917, -7.0926],
  tunisia: [33.8869, 9.5375],
  russia: [61.524, 105.3188],
  poland: [51.9194, 19.1451],
  hungary: [47.1625, 19.5033],
  croatia: [45.1, 15.2],
  cyprus: [35.1264, 33.4299],
  israel: [31.0461, 34.8516],
  georgia: [42.3154, 43.3569],
  azerbaijan: [40.1431, 47.5769],
  "sri lanka ": [7.8731, 80.7718],
};

const normalize = (value) => String(value || "").trim().toLowerCase();

// Splits a comma-joined arrivePlace string ("Dubai, Abu Dhabi") into
// individual candidates and returns the first one with a known coordinate.
const matchCityFromPlaceString = (placeStr) => {
  const candidates = normalize(placeStr)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const candidate of candidates) {
    if (CITY_CENTROIDS[candidate]) return CITY_CENTROIDS[candidate];
  }
  return null;
};

/**
 * Resolves an "almost" [lat, lng] for a package's arrival location, using
 * only the place/country name strings the backend already stores (no
 * lat/lng column anywhere in that chain, no external geocoding call).
 * City-level match wins when recognized; otherwise falls back to the
 * country centroid. Returns null when neither is recognized — callers
 * should skip the marker rather than guess.
 *
 * @param {string} placeStr - e.g. "Dubai, Abu Dhabi" (pkg.arrivePlace)
 * @param {string} countryStr - e.g. "United Arab Emirates" (pkg.arriveCountryName)
 * @returns {[number, number] | null}
 */
export function resolveApproxLocation(placeStr, countryStr) {
  const cityMatch = matchCityFromPlaceString(placeStr);
  if (cityMatch) return cityMatch;

  const country = normalize(countryStr);
  if (country && country !== "n/a" && COUNTRY_CENTROIDS[country]) {
    return COUNTRY_CENTROIDS[country];
  }
  return null;
}
