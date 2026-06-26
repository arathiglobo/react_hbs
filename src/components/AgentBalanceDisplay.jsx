import React, { useEffect, useState } from "react";
import axiosInstance from "./AxiosInstance";

/**
 * Renders the "Available Balance: X" line beneath an agent dropdown.
 * Self-contained: takes an agentId, fetches /api/agent-credit-limit/agent/{id},
 * shows loading / value / unavailable states. Returns null when no agent is
 * selected.
 *
 * Usage:
 *   <AgentBalanceDisplay agentId={agent} />
 *
 * Matches the styling used in HotelSearch.jsx so the whole app stays
 * consistent.
 */
const AgentBalanceDisplay = ({ agentId }) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    axiosInstance
      .get(`/api/agent-credit-limit/agent/${agentId}`)
      .then((res) => {
        if (!cancelled) {
          setBalance(res?.data?.availableCreditLimit ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (!agentId) return null;

  return (
    <div className="mt-1 small">
      {loading ? (
        <span className="text-muted">Loading available balance…</span>
      ) : balance != null ? (
        <span className="fw-semibold" style={{ color: "#dc3545" }}>
          Available Balance: {Number(balance).toFixed(2)} AED
        </span>
      ) : (
        <span className="text-muted">Available balance unavailable</span>
      )}
    </div>
  );
};

export default AgentBalanceDisplay;
