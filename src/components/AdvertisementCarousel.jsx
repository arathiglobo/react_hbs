import React, { useEffect, useMemo, useRef, useState } from "react";
import { Carousel, Button, Modal } from "react-bootstrap";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import axiosInstance from "./AxiosInstance";

// Styles for the ad popup modal: a fixed-height letterboxed image with the
// title / description / CTA below it. Auto-advances while the modal is open.
const ADS_CSS = `
.hs-ads-modal .modal-body { padding: 0; }
.hs-ads-slide { display: flex; flex-direction: column; }
.hs-ads-img {
  flex: 0 0 auto; height: 360px; overflow: hidden;
  cursor: pointer;
  /* neutral letterbox background behind images whose aspect ratio doesn't
     exactly match the box (so contain doesn't leave a transparent gap) */
  background: #f6f6f4;
  display: flex; align-items: center; justify-content: center;
}
/* contain (not cover) so the WHOLE ad image is always visible. */
.hs-ads-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
.hs-ads-fallback {
  min-height: 240px;
  background: linear-gradient(135deg,#4f46e5,#7c3aed);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; text-align: center; padding: 12px;
}
.hs-ads-meta { padding: 16px 20px 4px; }
.hs-ads-nav {
  border: 1px solid #E5E5E1; background: #fff; color: #EC0B43;
  width: 28px; height: 28px; border-radius: 7px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background .15s ease, color .15s ease;
}
.hs-ads-nav:hover { background: #EC0B43; color: #fff; }
`;

/**
 * Sponsored-ad popup, shown automatically on page load.
 *
 * Ads are fetched from /api/advertisement/active. When a city is selected
 * (cityId), the backend returns that city's ads first, then the remaining
 * active ads. Each ad may have several images, so the carousel shows one
 * slide per image (keeping ads — and the city-first order — together).
 *
 * Behaviour: a centered modal opens once on first load (when ads are
 * available) with a 3-second auto-advancing carousel. The prev/next arrows
 * step manually. An OK button (and the close X) dismisses the popup.
 *
 * Impressions/views are recorded for whichever slide is visible while the
 * popup is open; clicks are recorded when an ad is clicked (and its target
 * URL, if any, is opened).
 */
export default function AdvertisementCarousel({ cityId, cityName }) {
  const [ads, setAds] = useState([]);
  const [index, setIndex] = useState(0);
  // Popup visibility. Opens once automatically when ads first load (tracked by
  // autoShownRef) so re-fetching on a city change doesn't keep reopening it.
  const [show, setShow] = useState(false);
  const autoShownRef = useRef(false);
  const impressedRef = useRef(new Set());
  // Ads whose "view" we've already POSTed this mount (the backend further
  // dedupes per login-session + page, so repeats are harmless no-ops).
  const viewedRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    const fetchAds = async () => {
      try {
        const params = cityId ? `?cityId=${cityId}` : "";
        const res = await axiosInstance.get(
          `/api/advertisement/active${params}`,
        );
        if (cancelled) return;
        setAds(Array.isArray(res.data) ? res.data : []);
        setIndex(0);
        impressedRef.current = new Set();
        viewedRef.current = new Set();
      } catch (err) {
        if (!cancelled) setAds([]);
      }
    };
    fetchAds();
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  // One slide per image; ads with no image still get a single (fallback) slide.
  const slides = useMemo(() => {
    const out = [];
    ads.forEach((ad) => {
      const imgs =
        Array.isArray(ad.imageUrls) && ad.imageUrls.length > 0
          ? ad.imageUrls
          : ad.imageUrl
            ? [ad.imageUrl]
            : [null];
      imgs.forEach((img) => out.push({ ad, img }));
    });
    return out;
  }, [ads]);

  // Keep the index in range if the slide list shrinks.
  useEffect(() => {
    setIndex((i) => (slides.length === 0 ? 0 : i % slides.length));
  }, [slides.length]);

  // Auto-open the popup the first time ads become available.
  useEffect(() => {
    if (slides.length > 0 && !autoShownRef.current) {
      autoShownRef.current = true;
      setShow(true);
    }
  }, [slides.length]);

  const recordImpression = (ad) => {
    if (!ad || impressedRef.current.has(ad.advertisementId)) return;
    impressedRef.current.add(ad.advertisementId);
    axiosInstance
      .post(`/api/advertisement/${ad.advertisementId}/impression`)
      .catch(() => {});
  };

  // Record a "view": counted once per ad per (login session, page). The
  // session id is minted on login; the page is the current route path. The
  // backend enforces the once-per-(session,page) rule, so re-visiting the same
  // page in the same login does not increase the count, but a fresh login does.
  const recordView = (ad) => {
    if (!ad || viewedRef.current.has(ad.advertisementId)) return;
    const sessionId = localStorage.getItem("adSessionId");
    if (!sessionId) return; // not logged in via the normal flow — skip
    viewedRef.current.add(ad.advertisementId);
    axiosInstance
      .post(`/api/advertisement/${ad.advertisementId}/view`, {
        sessionId,
        pageKey: window.location.pathname,
      })
      .catch(() => {});
  };

  // Record an impression + a view for whatever slide is visible while the
  // popup is open.
  useEffect(() => {
    if (show && slides[index]) {
      recordImpression(slides[index].ad);
      recordView(slides[index].ad);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides, show]);

  // Self-managed auto-advance while the popup is open. Re-arms on every index
  // change (so manual prev/next also resets the 3-second countdown).
  useEffect(() => {
    if (!show || slides.length <= 1) return undefined;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 3000);
    return () => clearTimeout(t);
  }, [index, slides.length, show]);

  const goPrev = () =>
    setIndex((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setIndex((i) => (i + 1) % slides.length);

  const handleClick = (ad) => {
    axiosInstance
      .post(`/api/advertisement/${ad.advertisementId}/click`)
      .catch(() => {});
    if (ad.targetUrl) {
      window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (slides.length === 0) return null;

  const hasMany = slides.length > 1;
  const close = () => setShow(false);

  return (
    <>
      <style>{ADS_CSS}</style>
      <Modal
        show={show}
        onHide={close}
        centered
        dialogClassName="hs-ads-modal"
      >
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
            <span className="fw-semibold text-primary">Sponsored</span>
            {cityName ? (
              <span className="text-muted fw-normal small">
                · {cityName.split(",")[0]}
              </span>
            ) : null}
          </Modal.Title>
          {hasMany && (
            <div className="d-flex gap-1 align-items-center ms-auto me-2">
              <button
                type="button"
                className="hs-ads-nav"
                onClick={goPrev}
                aria-label="Previous ad"
              >
                <FaChevronLeft size={12} />
              </button>
              <button
                type="button"
                className="hs-ads-nav"
                onClick={goNext}
                aria-label="Next ad"
              >
                <FaChevronRight size={12} />
              </button>
            </div>
          )}
        </Modal.Header>

        <Modal.Body>
          <Carousel
            activeIndex={index}
            onSelect={(i) => setIndex(i)}
            interval={null}
            controls={false}
            indicators={hasMany}
          >
            {slides.map(({ ad, img }, i) => (
              <Carousel.Item key={`${ad.advertisementId}-${i}`}>
                <div className="hs-ads-slide">
                  {img ? (
                    <div
                      className="hs-ads-img"
                      title="Click to open"
                      onClick={() => handleClick(ad)}
                    >
                      <img
                        src={img}
                        alt={ad.title}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="hs-ads-fallback">{ad.title}</div>
                  )}
                  <div className="hs-ads-meta">
                    <div className="fw-semibold text-dark">{ad.title}</div>
                    {ad.description ? (
                      <div className="text-muted small mt-1">
                        {ad.description}
                      </div>
                    ) : null}
                    <Button
                      size="sm"
                      className="mt-2 btn-indigo"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClick(ad);
                      }}
                    >
                      {ad.buttonText || "Learn More"}
                    </Button>
                  </div>
                </div>
              </Carousel.Item>
            ))}
          </Carousel>
        </Modal.Body>

        <Modal.Footer className="py-2">
          <Button variant="primary" onClick={close} className="px-4">
            OK
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
