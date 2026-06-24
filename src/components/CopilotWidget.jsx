import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import axiosInstance from "./AxiosInstance";

/**
 * Booking-screen AI copilot — floating chat widget.
 *
 * Mounted once globally; self-hides on routes that aren't booking-related.
 * Auto-pulls page context from sessionStorage so individual booking pages
 * don't have to know the widget exists.
 */

// Routes where the widget is shown
const BOOKING_ROUTE_PREFIXES = [
  "/new-booking",
  "/hotel-booking-page",
  "/long-stay-booking-page",
  "/long-stay-room-list",
  "/booking-details",
  "/room-list",
  "/api-room-list",
];

const isBookingRoute = (pathname) =>
  BOOKING_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));

// ─────────────────────────────────────────────────────────────────
// Context auto-detector — tries every storage key the booking flow uses
// ─────────────────────────────────────────────────────────────────
function detectContext(pathname) {
  try {
    // 1. Hotel-booking page → sessionStorage `bookingData`
    const bd = sessionStorage.getItem("bookingData");
    if (bd) {
      const d = JSON.parse(bd);
      const sel = d.selectedRate || {};
      const stat = d.hotelStaticData || {};
      const pay = d.payload || {};
      const ctx = {
        pageType: "HOTEL_BOOKING",
        hotelName: stat.hotelName,
        starRating: stat.starRating,
        checkInDate: pay.checkInDate,
        checkOutDate: pay.checkOutDate,
        nights: pay.checkInDate && pay.checkOutDate
          ? Math.max(1, Math.round(
              (new Date(pay.checkOutDate) - new Date(pay.checkInDate)) / 86400000
            ))
          : null,
        currency: sel.currency,
        rate: {
          label: `${sel.roomCategory || ""} (${sel.mealPlan || ""})`,
          mealPlan: sel.mealPlan,
          breakfastIncluded:
            (sel.mealPlan || "").toLowerCase().includes("breakfast") ||
            ["BB", "HB", "FB", "AI"].includes(String(sel.mealPlan || "").toUpperCase()),
          refundable: sel.nonRefundable === undefined ? undefined : !sel.nonRefundable,
          extraBedAvailable: sel.extraBed === true,
          rate: typeof sel.rate === "number" ? sel.rate : Number(sel.rate),
          rateWithoutMarkup: sel.rateWithoutMarkup,
          roomCategory: sel.roomCategory,
          roomType: sel.mealPlan,
          occupancy: sel.occupancy,
          currency: sel.currency,
          roomStatus: sel.roomStatus,
        },
        cancellationPolicy: sel.cancellationPolicy,
      };
      return ctx;
    }

    // 2. Long-stay booking page → sessionStorage `longStayBookingDraft`
    const ls = sessionStorage.getItem("longStayBookingDraft");
    if (ls) {
      const d = JSON.parse(ls);
      const ctx = {
        pageType: "LONG_STAY_BOOKING",
        hotelName: d.hotelName,
        hotelId: d.hotelId,
        checkInDate: d.checkIn,
        checkOutDate: d.checkOut,
        nights:
          d.checkIn && d.checkOut
            ? Math.max(1, Math.round((new Date(d.checkOut) - new Date(d.checkIn)) / 86400000))
            : null,
        rate: {
          label: `Long-stay ${d.contract?.rateCode || ""} (${d.contract?.additionalCostType || ""})`,
          mealPlan: d.room?.meal ? "BB" : "RO",
          breakfastIncluded: !!d.room?.meal,
          refundable: !!d.room?.refundable,
          extraBedAvailable: !!d.room?.extraBed,
          rate: d.room?.monthlyRate,
          roomCategory: `Room #${d.room?.longStayRoomId}`,
          roomType: d.contract?.additionalCostType,
          occupancy: d.room?.occupancyTypeId,
        },
        extra: { contract: d.contract, room: d.room },
      };
      return ctx;
    }

    // 3. Long-stay room list → `longStayRoomListPayload`
    const lr = sessionStorage.getItem("longStayRoomListPayload");
    if (lr) {
      const d = JSON.parse(lr);
      return {
        pageType: "ROOM_LIST",
        hotelName: d.meta?.hotelName,
        hotelId: d.payload?.hotelId,
        starRating: d.meta?.starRating,
        checkInDate: d.payload?.checkInDate,
        checkOutDate: d.payload?.checkOutDate,
      };
    }

    // 4. Hotel-search room list → `roomListPayload`
    const rl = sessionStorage.getItem("roomListPayload");
    if (rl) {
      const d = JSON.parse(rl);
      return {
        pageType: "ROOM_LIST",
        hotelName: d.meta?.hotelName,
        starRating: d.meta?.starRating,
        checkInDate: d.payload?.checkInDate,
        checkOutDate: d.payload?.checkOutDate,
      };
    }
  } catch {
    // ignore — ctx stays null
  }
  return { pageType: pathname };
}

// Conversation entry shape: { role: "user"|"copilot", text, intent?, confidence?, citations?, followUps? }
export default function CopilotWidget() {
  const { pathname } = useLocation();
  const visible = isBookingRoute(pathname);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState([]);
  const conversationId = useRef(`c-${Date.now()}`).current;
  const bottomRef = useRef(null);

  // ── Draggable position ────────────────────────────────────────────
  // The widget defaults to the bottom-right corner. Once the user drags it
  // (by the launcher button when closed, or the panel header when open) its
  // top-left position is kept here + persisted to localStorage, so it stays
  // where they dropped it across route changes and reloads. `null` = use the
  // default corner anchor.
  const POS_KEY = "copilotWidgetPos";
  const wrapperRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const [pos, setPos] = useState(() => {
    try {
      const s = localStorage.getItem(POS_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  // Persist the dropped position.
  useEffect(() => {
    if (pos) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        /* ignore quota / disabled storage */
      }
    }
  }, [pos]);

  // Keep the widget on-screen when it opens/closes (its size changes) or the
  // window is resized.
  useEffect(() => {
    const clamp = () =>
      setPos((p) => {
        if (!p) return p;
        const wrap = wrapperRef.current;
        const w = wrap ? wrap.offsetWidth : 0;
        const h = wrap ? wrap.offsetHeight : 0;
        const x = Math.max(0, Math.min(p.x, window.innerWidth - w));
        const y = Math.max(0, Math.min(p.y, window.innerHeight - h));
        return x === p.x && y === p.y ? p : { x, y };
      });
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open]);

  // Pointer-based drag. The handle captures the pointer so dragging keeps
  // working even when the cursor leaves it. Elements marked [data-nodrag]
  // (e.g. the close button) don't start a drag.
  const startDrag = (e) => {
    if (e.target.closest("[data-nodrag]")) return;
    if (e.button != null && e.button !== 0) return;
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
    };
    movedRef.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* older browsers */
    }
  };

  const moveDrag = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (
      Math.abs(e.clientX - d.startX) > 4 ||
      Math.abs(e.clientY - d.startY) > 4
    ) {
      movedRef.current = true;
    }
    const wrap = wrapperRef.current;
    const w = wrap ? wrap.offsetWidth : 0;
    const h = wrap ? wrap.offsetHeight : 0;
    const x = Math.max(0, Math.min(e.clientX - d.offsetX, window.innerWidth - w));
    const y = Math.max(0, Math.min(e.clientY - d.offsetY, window.innerHeight - h));
    setPos({ x, y });
  };

  const endDrag = (e) => {
    if (!dragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  };

  // Suppress the "open" click that fires at the end of a drag.
  const handleLauncherClick = () => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setOpen(true);
  };

  // Refresh context when the panel opens or the route changes
  const ctx = useMemo(() => detectContext(pathname), [pathname, open]);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, thread]);

  if (!visible) return null;

  const seed = thread.length === 0
    ? [
        {
          role: "copilot",
          text:
            ctx?.hotelName
              ? `Hi — I'm your booking copilot. I can answer about ${ctx.hotelName}'s rate plan, cancellation policy, meal inclusion, and compare rooms.`
              : "Hi — I'm your booking copilot. Open a rate or room list and I'll answer questions about it.",
          followUps:
            ctx?.rooms?.length >= 2
              ? ["Compare these rooms", "Which one is cheapest?"]
              : ctx?.rate
              ? [
                  "Is breakfast included?",
                  "What's the cancellation policy?",
                  "Is this rate refundable?",
                ]
              : ["What can you help with?"],
        },
      ]
    : thread;

  const ask = async (q) => {
    if (!q || !q.trim() || sending) return;
    const userMsg = { role: "user", text: q.trim() };
    const next = [...(thread.length === 0 ? seed : thread), userMsg];
    setThread(next);
    setInput("");
    setSending(true);
    try {
      const res = await axiosInstance.post("/api/ai/copilot/ask", {
        question: q.trim(),
        conversationId,
        context: ctx,
      });
      const r = res.data;
      setThread([
        ...next,
        {
          role: "copilot",
          text: r.answer,
          intent: r.intent,
          confidence: r.confidence,
          citations: r.citations,
          followUps: r.suggestedFollowUps,
        },
      ]);
    } catch (e) {
      setThread([
        ...next,
        {
          role: "copilot",
          text:
            "I couldn't reach the copilot service. Check the network tab — the booking flow itself isn't affected.",
          intent: "ERROR",
          confidence: 0,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "fixed",
        zIndex: 1080,
        ...(pos ? { left: pos.x, top: pos.y } : { right: 20, bottom: 20 }),
      }}
    >
      {/* Launcher button — also the drag handle when closed */}
      {!open && (
        <button
          aria-label="Open booking copilot"
          onClick={handleLauncherClick}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          style={launcherStyle}
          title="Drag to move · click to open"
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>💬</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Copilot</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={panelStyle} role="dialog" aria-label="Booking copilot">
          <div
            style={panelHeaderStyle}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            title="Drag to move"
          >
            <div>
              <div style={{ fontWeight: 700 }}>Booking Copilot</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                {ctx?.hotelName
                  ? `${ctx.hotelName}${ctx.starRating ? ` · ${ctx.starRating}★` : ""}`
                  : "No booking context yet"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={panelCloseBtnStyle}
              data-nodrag="true"
            >
              ×
            </button>
          </div>

          <div style={panelBodyStyle}>
            {(thread.length === 0 ? seed : thread).map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "#0d6efd" : "#f3f4f6",
                  color: m.role === "user" ? "#fff" : "#1f2937",
                  padding: "8px 10px",
                  borderRadius: 10,
                  maxWidth: "85%",
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.4,
                  marginBottom: 6,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                }}
              >
                {m.text}
                {m.role === "copilot" && m.confidence !== undefined && m.confidence < 0.5 && (
                  <span
                    style={{
                      display: "inline-block",
                      marginLeft: 8,
                      fontSize: 10,
                      background: "#fde68a",
                      color: "#92400e",
                      padding: "1px 6px",
                      borderRadius: 8,
                    }}
                  >
                    rough
                  </span>
                )}
                {m.role === "copilot" && m.citations && m.citations.length > 0 && (
                  <details style={{ marginTop: 6, fontSize: 11 }}>
                    <summary style={{ cursor: "pointer", color: "#6b7280" }}>
                      Sources ({m.citations.length})
                    </summary>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: 16, color: "#4b5563" }}>
                      {m.citations.map((c, j) => (
                        <li key={j} style={{ fontFamily: "monospace" }}>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {m.role === "copilot" && m.followUps && m.followUps.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {m.followUps.map((q, k) => (
                      <button
                        key={k}
                        onClick={() => ask(q)}
                        style={chipStyle}
                        disabled={sending}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: "flex-start", color: "#6b7280", fontSize: 12 }}>
                copilot is thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            style={panelFooterStyle}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the rate, policy, rooms…"
              style={inputStyle}
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()} style={sendBtnStyle}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ────────────────────── inline styles (no global CSS) ──────────────────────
const launcherStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  background: "#0d6efd",
  color: "#fff",
  border: "none",
  borderRadius: 30,
  padding: "10px 14px",
  cursor: "grab",
  touchAction: "none",
  userSelect: "none",
  boxShadow: "0 6px 16px rgba(13, 110, 253, 0.35)",
};

const panelStyle = {
  width: 360,
  maxHeight: "70vh",
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  fontFamily:
    "'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const panelHeaderStyle = {
  background: "linear-gradient(135deg, #0d6efd, #7c3aed)",
  color: "#fff",
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "grab",
  touchAction: "none",
  userSelect: "none",
};

const panelCloseBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

const panelBodyStyle = {
  padding: 12,
  overflowY: "auto",
  flexGrow: 1,
  display: "flex",
  flexDirection: "column",
  background: "#fafafa",
};

const panelFooterStyle = {
  display: "flex",
  gap: 6,
  padding: 8,
  borderTop: "1px solid #e5e7eb",
  background: "#fff",
};

const inputStyle = {
  flexGrow: 1,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 13,
  outline: "none",
};

const sendBtnStyle = {
  background: "#0d6efd",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const chipStyle = {
  background: "#fff",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "3px 8px",
  fontSize: 11,
  cursor: "pointer",
  color: "#1f2937",
};
