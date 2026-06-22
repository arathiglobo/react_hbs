import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
// NOTE: do NOT import bootstrap/dist/css/bootstrap.min.css here — it is global
// and re-introduces the default blue theme on top of the red SCSS build.
import "bootstrap/dist/js/bootstrap.bundle.min";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../styles/Login.css";
import "../styles/LoginModern.css";
import DashboardRedirections from "../components/DashboardRedirections";
import axiosInstance from "../components/AxiosInstance";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [forgetEmail, setForgetEmail] = useState("");
  const [forgetUsername, setForgetUsername] = useState("");
  // Promo carousel on the login brand panel. Two public sources feed it:
  //   1. OfferZone banners (/api/offerDetails) — shown FIRST, each carrying a
  //      description + validity dates overlaid on the banner image.
  //   2. Offer images (/api/offerImageUpload/public) — plain promo images,
  //      appended after the banners.
  // Section hides completely when neither source has anything to show.
  const [slides, setSlides] = useState([]);
  const [offerIdx, setOfferIdx] = useState(0);
  const navigate = useNavigate();

  // Fetch both public sources once on mount and flatten them into a single
  // ordered list of slide objects ({ url, title?, description?, validity* }).
  useEffect(() => {
    let alive = true;
    const apiBase = process.env.REACT_APP_API_BASE_URL || "";

    Promise.all([
      axiosInstance.get("/api/offerDetails").catch(() => ({ data: [] })),
      axiosInstance
        .get("/api/offerImageUpload/public")
        .catch(() => ({ data: [] })),
    ])
      .then(([offerRes, imageRes]) => {
        if (!alive) return;
        const next = [];

        // OfferZone banners first — with text overlay (description + validity).
        // bannerImagePah is already a full /images/ URL served publicly.
        if (Array.isArray(offerRes.data)) {
          offerRes.data.forEach((offer) => {
            if (!offer.bannerImagePah) return;
            next.push({
              key: `offer-${offer.offerId}`,
              url: offer.bannerImagePah,
              title: offer.title,
              description: offer.description,
              validityFrom: offer.validityFrom,
              validityTo: offer.validityTo,
            });
          });
        }

        // Offer-upload images next — image only, no overlay.
        if (Array.isArray(imageRes.data)) {
          imageRes.data.forEach((set) => {
            if (set.hasImage1) {
              next.push({
                key: `img-${set.id}-1`,
                url: `${apiBase}/api/offerImageUpload/public/${set.id}/image1`,
              });
            }
            if (set.hasImage2) {
              next.push({
                key: `img-${set.id}-2`,
                url: `${apiBase}/api/offerImageUpload/public/${set.id}/image2`,
              });
            }
          });
        }

        setSlides(next);
        setOfferIdx(0);
      })
      .catch(() => {
        if (alive) setSlides([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Auto-rotate through slides when there is more than one.
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => {
      setOfferIdx((i) => (i + 1) % slides.length);
    }, 4000);
    return () => clearInterval(t);
  }, [slides]);

  // Format a LocalDateTime string ("2026-06-22T00:00:00") to a readable date.
  const formatOfferDate = (value) => {
    if (!value) return "";
    const datePart = typeof value === "string" ? value.split("T")[0] : value;
    const d = new Date(datePart);
    if (Number.isNaN(d.getTime())) return datePart;
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const loginRequest = { username: `${username}`, password: `${password}` };
      const response = await axiosInstance.post("/auth/login", loginRequest, {
        withCredentials: true,
      });

      const token = response.data.token;
      const roles = response.data.roles;
      const loginedUserName = response.data.username;

      if (!token || !roles || !loginedUserName) {
        throw new Error("Invalid response from server: Missing token or roles or username");
      }

      localStorage.setItem("authToken", token);
      localStorage.setItem("userRole", roles);
      localStorage.setItem("UserName", loginedUserName);

      if (roles.length > 1) {
        navigate("/select-userRole", { state: { roles } });
      } else {
        DashboardRedirections(roles[0] || "User", navigate);
      }
    } catch (err) {
      setError("Invalid username or password");
    }
  };

  const handleForgetPasswordSubmit = (e) => {
    e.preventDefault();
    console.log("Forget Password:", { email: forgetEmail, username: forgetUsername });
    const modal = document.getElementById("exampleModal");
    if (modal) {
      const bootstrapModal = window.bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) bootstrapModal.hide();
    }
  };

  return (
    <div className="lg-shell">
      {/* ── Left · brand panel ── */}
      <aside className="lg-brand">
        {/* ── Offer showcase (from /upload-offer-image) ──
            Sits directly under the brand logo so it's the first visual the
            user sees. Section is conditional — when no offers are uploaded
            it disappears completely and the original layout shows. */}
        {slides.length > 0 && (
          <div className="lg-offers">
            <div className="lg-offers-head">
              <span className="lg-offer-pill">
                <i className="fas fa-tag"></i> Offer
              </span>
              <span className="lg-offers-title">Limited-time promotions</span>
            </div>

            <div className="lg-offer-frame">
              {slides.map((slide, i) => (
                <img
                  key={slide.key}
                  src={slide.url}
                  alt={slide.title || `Offer ${i + 1}`}
                  className={`lg-offer-img${i === offerIdx ? " is-active" : ""}`}
                />
              ))}
              <div className="lg-offer-shade" aria-hidden="true" />

              {/* Details overlay for the active slide — only banners coming
                  from OfferZone carry a description / validity window. */}
              {(() => {
                const active = slides[offerIdx];
                if (
                  !active ||
                  (!active.description &&
                    !active.validityFrom &&
                    !active.validityTo)
                ) {
                  return null;
                }
                return (
                  <div className="lg-offer-caption">
                    {active.title && (
                      <div className="lg-offer-caption-title">
                        {active.title}
                      </div>
                    )}
                    {active.description && (
                      <p className="lg-offer-caption-desc">
                        {active.description}
                      </p>
                    )}
                    {(active.validityFrom || active.validityTo) && (
                      <div className="lg-offer-caption-validity">
                        <i className="fas fa-calendar-alt"></i>
                        <span>
                          {active.validityFrom && active.validityTo
                            ? `${formatOfferDate(
                                active.validityFrom,
                              )} – ${formatOfferDate(active.validityTo)}`
                            : active.validityFrom
                            ? `From ${formatOfferDate(active.validityFrom)}`
                            : `Until ${formatOfferDate(active.validityTo)}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous offer"
                    className="lg-offer-nav lg-offer-nav--prev"
                    onClick={() =>
                      setOfferIdx(
                        (i) => (i - 1 + slides.length) % slides.length,
                      )
                    }
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <button
                    type="button"
                    aria-label="Next offer"
                    className="lg-offer-nav lg-offer-nav--next"
                    onClick={() => setOfferIdx((i) => (i + 1) % slides.length)}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>

                  <div className="lg-offer-dots">
                    {slides.map((slide, i) => (
                      <button
                        key={slide.key}
                        type="button"
                        aria-label={`Show offer ${i + 1}`}
                        className={`lg-offer-dot${
                          i === offerIdx ? " is-active" : ""
                        }`}
                        onClick={() => setOfferIdx(i)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="lg-hero">
          <h1>Manage hotel contracts with confidence.</h1>
          <p>
            One platform to manage contracts, track performance, and grow your
            relationships with leading hotel chains worldwide.
          </p>
        </div>

        <div className="lg-features">
          <div className="lg-feature">
            <i className="fas fa-chart-line"></i>
            <span>Real-time performance analytics</span>
          </div>
          <div className="lg-feature">
            <i className="fas fa-handshake"></i>
            <span>End-to-end contract management</span>
          </div>
          <div className="lg-feature">
            <i className="fas fa-globe"></i>
            <span>5000+ hotels across 150+ countries</span>
          </div>
        </div>

        <div className="lg-brand-foot">
          © {new Date().getFullYear()} Globosoft. All rights reserved.
        </div>
      </aside>

      {/* ── Right · sign-in card ── */}
      <main className="lg-main">
        <div className="lg-card">
          <div className="lg-brand-top lg-brand-top--card">
            <img
              src={`${process.env.PUBLIC_URL}/images/logo-1.jpg`}
              alt="Globosoft"
              className="lg-logo"
            />
            <div>
              <div className="lg-brand-name">Globosoft</div>
              <div className="lg-brand-sub">Global Contracting Solutions</div>
            </div>
          </div>

          <div className="lg-head">
            <h2>Welcome back</h2>
            <p>Sign in to your contracting dashboard</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="lg-field">
              <label htmlFor="username">
                <i className="fas fa-user"></i> Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="lg-field">
              <label htmlFor="password">
                <i className="fas fa-lock"></i> Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="lg-error">{error}</div>}

            <button type="submit" className="lg-submit">
              <i className="fas fa-sign-in-alt"></i> Sign In
            </button>

            <div className="lg-links">
              <Link to="/register" className="lg-link">
                <i className="fas fa-user-plus"></i> Create Account
              </Link>
              <button
                type="button"
                className="lg-link"
                data-bs-toggle="modal"
                data-bs-target="#exampleModal"
              >
                <i className="fas fa-key"></i> Forgot Password?
              </button>
            </div>
          </form>

          <div className="lg-secure">
            <i className="fas fa-shield-alt"></i>
            <span>Protected with enterprise-grade security</span>
          </div>
        </div>
      </main>

      {/* ── Forgot Password Modal ── */}
      <div
        className="modal fade"
        id="exampleModal"
        tabIndex="-1"
        aria-labelledby="exampleModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="exampleModalLabel">
                <i className="fas fa-key me-2"></i>
                Reset Your Password
              </h1>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p className="modal-description text-muted mb-3">
                Enter your email and username to receive password reset instructions.
              </p>
              <form id="changePass" onSubmit={handleForgetPasswordSubmit} autoComplete="off">
                <div className="mb-3">
                  <label className="form-label" htmlFor="forgetmail">
                    <span className="text-danger">*</span> Email Address
                  </label>
                  <input
                    type="email"
                    id="forgetmail"
                    className="form-control"
                    name="forgetmail"
                    placeholder="Enter your email address"
                    value={forgetEmail}
                    onChange={(e) => setForgetEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="userCode">
                    <span className="text-danger">*</span> Username
                  </label>
                  <input
                    type="text"
                    id="userCode"
                    className="form-control"
                    name="userCode"
                    placeholder="Enter your username"
                    value={forgetUsername}
                    onChange={(e) => setForgetUsername(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" id="submit" className="btn w-100 lg-submit" style={{ marginTop: 4 }}>
                  Send Reset Link
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
