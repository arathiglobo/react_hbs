import { useEffect, useState } from "react";
import axiosInstance from "../components/AxiosInstance";
import { getUserRole, getCurrentActiveRole } from "../utils/authSession";

/**
 * Menu codes super_admin has HIDDEN for a role in Masters → Assign Menu,
 * from GET /api/sidebar/hidden-menus?role={role}.
 *
 * The Sidebar uses it to drop menu entries; pages use it to drop features
 * tied to a hidden entry (e.g. HotelSearch's Available Deals filter).
 *
 * @param role role slug (admin, agent, staff, extranet, super_admin). When
 *        omitted, the active role is used, falling back to the first stored
 *        role — the same order the Sidebar uses off the dashboard pages.
 * @return Set of hidden codes. Fail-open: empty while loading or on any
 *         error, so a network hiccup never removes anything.
 *
 * Re-fetched when Assign Menu saves or resets a role
 * ("sidebarHiddenMenusChanged"), so changes show without a reload.
 */
export default function useHiddenMenuCodes(role) {
  const resolvedRole = (
    role ??
    (getCurrentActiveRole() || getUserRole().split(",")[0] || "")
  )
    .trim()
    .toLowerCase();

  const [hiddenCodes, setHiddenCodes] = useState(() => new Set());

  useEffect(() => {
    if (!resolvedRole) {
      setHiddenCodes(new Set());
      return undefined;
    }
    let cancelled = false;
    const loadHiddenCodes = async () => {
      try {
        const res = await axiosInstance.get("/api/sidebar/hidden-menus", {
          params: { role: resolvedRole },
        });
        if (cancelled) return;
        const codes = Array.isArray(res?.data?.codes) ? res.data.codes : [];
        setHiddenCodes(new Set(codes));
      } catch (_) {
        if (!cancelled) setHiddenCodes(new Set());
      }
    };
    loadHiddenCodes();
    window.addEventListener("sidebarHiddenMenusChanged", loadHiddenCodes);
    return () => {
      cancelled = true;
      window.removeEventListener("sidebarHiddenMenusChanged", loadHiddenCodes);
    };
  }, [resolvedRole]);

  return hiddenCodes;
}
