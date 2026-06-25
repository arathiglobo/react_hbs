import React, { useEffect, useMemo, useRef, useState } from "react";
import { Carousel, Card, Button, Modal } from "react-bootstrap";
import {
  FaChevronLeft,
  FaChevronRight,
  FaMinus,
  FaPlus,
} from "react-icons/fa";
import axiosInstance from "./AxiosInstance";

// The ad sits in a flex row beside the search card. We give it its own fixed
// height and align it to the top (align-self:flex-start) instead of letting it
// stretch to the row height — otherwise expanding the "Rooms & Guests" panel
// grows the search card, and the stretched ad grows (and its image distorts)
// along with it. With a fixed height only the form grows; the ad stays put.
const ADS_CSS = `
.hs-ads-panel { display: flex; align-self: flex-start; }
.hs-ads-panel .card { display: flex; flex-direction: column; width: 100%; }
.hs-ads-panel .card-body { display: flex; flex-direction: column; flex: 1 1 auto; }
.hs-ads-panel .hs-ads-carousel { flex: 1 1 auto; display: flex; }
.hs-ads-panel .hs-ads-carousel .carousel { width: 100%; }
.hs-ads-panel .carousel-inner { height: 100%; }
.hs-ads-panel .carousel-item { height: 100%; }
.hs-ads-panel .carousel-item.active,
.hs-ads-panel .carousel-item-next,
.hs-ads-panel .carousel-item-prev {
  display: flex !important;
  flex-direction: column;
}
.hs-ads-slide { height: 100%; display: flex; flex-direction: column; }
.hs-ads-img {
  /* Fixed image height + auto panel height (see .hs-ads-panel): the panel
     sizes to image + meta so the "Learn More" meta below is never clipped,
     while align-self:flex-start keeps the ad from stretching with the form. */
  flex: 0 0 auto; height: 340px; overflow: hidden; border-radius: 8px;
  cursor: pointer;
  /* neutral letterbox background behind images whose aspect ratio doesn't
     exactly match the box (so contain doesn't leave a transparent gap) */
  background: #f6f6f4;
  display: flex; align-items: center; justify-content: center;
}
/* contain (not cover) so the WHOLE ad image is always visible — cover was
   cropping the top/bottom (or sides) of posters with different aspect ratios
   as you moved between slides. */
.hs-ads-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
.hs-ads-fallback {
  flex: 1 1 auto; min-height: 180px; border-radius: 8px;
  background: linear-gradient(135deg,#4f46e5,#7c3aed);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 600; text-align: center; padding: 12px;
}
.hs-ads-meta { padding: 10px 4px 6px; }
.hs-ads-nav {
  border: 1px solid #E5E5E1; background: #fff; color: #EC0B43;
  width: 26px; height: 26px; border-radius: 7px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background .15s ease, color .15s ease;
}
.hs-ads-nav:hover { background: #EC0B43; color: #fff; }
/* Large image preview hugs the image (no big empty bars) */
.hs-ads-preview { max-width: fit-content !important; }
.hs-ads-preview .modal-content { width: auto; }
.hs-ads-preview .modal-body img {
  display: block; width: auto; height: auto;
  max-width: 88vw; max-height: 82vh; margin: 0 auto;
}
`;

/**
 * Ad carousel shown beside the hotel search criteria.
 *
 * Ads are fetched from /api/advertisement/active. When a city is selected
 * (cityId), the backend returns that city's ads first, then the remaining
 * active ads. Each ad may have several images, so the carousel shows one
 * slide per image (keeping ads — and the city-first order — together).
 *
 * The carousel is fully controlled here: a self-managed 3-second timer
 * auto-advances it, and the header arrows step prev/next. Each index change
 * (auto or manual) re-arms the timer.
 *
 * Impressions are recorded once per ad per mount; clicks are recorded when
 * an ad is clicked (and its target URL, if any, is opened).
 */
export default function AdvertisementCarousel({ cityId, cityName }) {
  const [ads, setAds] = useState([]);
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState(null); // image URL shown large
  const [minimized, setMinimized] = useState(false);
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

  // Record an impression + a view for whatever slide is currently shown.
  useEffect(() => {
    if (slides[index]) {
      recordImpression(slides[index].ad);
      recordView(slides[index].ad);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides]);

  // Self-managed auto-advance. Re-arms on every index change (so manual
  // prev/next also resets the 3-second countdown).
  useEffect(() => {
    if (minimized || slides.length <= 1) return undefined;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 3000);
    return () => clearTimeout(t);
  }, [index, slides.length, minimized]);

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

  return (
    <div
      className="d-none d-lg-flex hs-ads-panel"
      style={{ width: minimized ? "auto" : 300, flexShrink: 0 }}
    >
      <style>{ADS_CSS}</style>
      <Card className="shadow-sm rounded-xl bg-white">
        <Card.Header className="py-2 px-3 d-flex align-items-center justify-content-between gap-2">
          <span className="fw-semibold text-primary text-nowrap">
            Sponsored
            {!minimized && cityName ? (
              <span className="text-muted fw-normal small ms-1">
                · {cityName.split(",")[0]}
              </span>
            ) : null}
          </span>
          <div className="d-flex gap-1 align-items-center">
            {/* Prev / next arrows above the image */}
            {!minimized && hasMany && (
              <>
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
              </>
            )}
            {/* Minimize / restore the ad panel */}
            <button
              type="button"
              className="hs-ads-nav"
              onClick={() => setMinimized((m) => !m)}
              aria-label={minimized ? "Show ads" : "Minimize ads"}
              title={minimized ? "Show ads" : "Minimize ads"}
            >
              {minimized ? <FaPlus size={11} /> : <FaMinus size={11} />}
            </button>
          </div>
        </Card.Header>
        {!minimized && (
        <Card.Body className="p-2">
          <div className="hs-ads-carousel">
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
                        title="Click to preview"
                        onClick={() => setPreview(img)}
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
                      <div className="fw-semibold text-dark text-truncate">
                        {ad.title}
                      </div>
                      {ad.description ? (
                        <div
                          className="text-muted small"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {ad.description}
                        </div>
                      ) : null}
                      <Button
                        size="sm"
                        className="mt-2 w-100 btn-indigo"
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
          </div>
        </Card.Body>
        )}
      </Card>

      {/* Large image preview with a close button */}
      <Modal
        show={!!preview}
        onHide={() => setPreview(null)}
        centered
        dialogClassName="hs-ads-preview"
      >
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="h6 mb-0">Advertisement</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center">
          {preview && <img src={preview} alt="Advertisement preview" />}
        </Modal.Body>
      </Modal>
    </div>
  );
}
