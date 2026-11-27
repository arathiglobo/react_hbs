import React, { useCallback, useEffect, useState } from "react";
import { Alert, Form, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";
import toast from "react-hot-toast";
import axiosInstance from "../../../components/AxiosInstance";
import { fmtDateTime } from "./automapFormat";

/**
 * "Mapped hotels as one hotel in search" switch on Automated Hotel Mapping.
 *
 *   On  (default) — a hotel mapped across suppliers is one card in hotel
 *                   search at the cheapest rate, and its room list shows
 *                   every supplier's rooms.
 *   Off           — each supplier's hotel is its own card at that supplier's
 *                   price, and its room list shows only that supplier's rooms.
 *
 * Backed by GET/POST /api/hotel-mapping/auto/search-mapping (admin only). The
 * switch follows what the server saved, so a failed save leaves it as it was.
 */
export default function SearchMappingSwitch() {
  const [setting, setSetting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/api/hotel-mapping/auto/search-mapping", { timeout: 30000 });
      setSetting(res.data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || "The search setting could not be loaded.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (enabled) => {
    const confirm = await Swal.fire({
      title: enabled ? "Show mapped hotels as one hotel?" : "Show mapped hotels separately?",
      text: enabled
        ? "Hotel search will list a hotel mapped across suppliers once, at the cheapest rate, with every supplier's rooms."
        : "Hotel search will list each supplier's hotel on its own, at that supplier's price, with only that supplier's rooms.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: enabled ? "Turn on" : "Turn off",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;
    setSaving(true);
    try {
      const res = await axiosInstance.post("/api/hotel-mapping/auto/search-mapping", { enabled }, { timeout: 30000 });
      setSetting(res.data);
      setError(null);
      toast.success(enabled ? "Mapped hotels now show as one hotel in search." : "Mapped hotels now show separately in search.");
    } catch (err) {
      setError(err?.response?.data?.error || "The search setting could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const on = setting?.enabled !== false;

  return (
    <div className="ahm-panel p-3 mb-3">
      {error && (
        <Alert variant="danger" className="py-2 small">
          {error}
        </Alert>
      )}
      <div className="d-flex flex-wrap align-items-center gap-2">
        <Form.Check
          type="switch"
          id="search-mapping-enabled"
          label="Mapped hotels as one hotel in search"
          className="fw-semibold mb-0"
          checked={setting ? on : false}
          disabled={!setting || saving}
          onChange={(e) => save(e.target.checked)}
        />
        {saving && <Spinner animation="border" size="sm" role="status" aria-label="Saving" />}
        {setting && <span className={`small fw-semibold ${on ? "text-success" : "text-muted"}`}>{on ? "On" : "Off"}</span>}
      </div>
      <ul className="small text-muted mt-2 mb-2 ps-3">
        <li>
          <strong>On:</strong> a hotel mapped across suppliers is listed once, at the cheapest rate, and its room list
          shows every supplier's rooms.
        </li>
        <li>
          <strong>Off:</strong> each supplier's hotel is listed separately, at that supplier's price, and its room list
          shows only that supplier's rooms. Room Mapping has no effect while this is off.
        </li>
      </ul>
      <div className="small text-muted">
        Applies from the next hotel search, with no restart. Mappings themselves are not changed.
        {setting?.updatedBy && (
          <>
            {" "}
            Last changed by {setting.updatedBy} on {fmtDateTime(setting.updatedAt)}.
          </>
        )}
      </div>
    </div>
  );
}
