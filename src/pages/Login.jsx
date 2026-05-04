import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../styles/Login.css";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import DashboardRedirections from "../components/DashboardRedirections";
import axiosInstance from "../components/AxiosInstance";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [forgetEmail, setForgetEmail] = useState("");
  const [forgetUsername, setForgetUsername] = useState("");
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const loginRequest = {
        username: `${username}`,
        password: `${password}`,
      };
      const response = await axiosInstance.post("/auth/login", loginRequest, {
        withCredentials: true,
      });

      console.log("api login response :", response);

      const token = response.data.token;
      const roles = response.data.roles;
      const loginedUserName = response.data.username;

      if (!token || !roles || !loginedUserName) {
        throw new Error(
          "Invalid response from server: Missing token or roles or username"
        );
      }

      localStorage.setItem("authToken", token);
      localStorage.setItem("userRole", roles);
      localStorage.setItem("UserName", loginedUserName);

      if (roles.length > 1) {
        console.log("navigate to select roles");
        navigate("/select-userRole", { state: { roles } });

        //   navigate("/select-userRole", {
        //   state: { roles, userId, userTypeId },
        // });
      } else {
        DashboardRedirections(roles[0] || "User", navigate);
      }
    } catch (err) {
      setError("Invalid username or password");
    }
  };

  const handleForgetPasswordSubmit = (e) => {
    e.preventDefault();
    console.log("Forget Password:", {
      email: forgetEmail,
      username: forgetUsername,
    });
    const modal = document.getElementById("exampleModal");
    if (modal) {
      const bootstrapModal = window.bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) {
        bootstrapModal.hide();
      }
    }
  };

  const handleInsuranceClick = () => {
    // Redirect to insurance site - can be made dynamic later
    window.open("https://www.travelinsurance.com", "_blank");
  };

  // Fetch offers data from API
  const fetchOffers = async () => {
    try {
      setOffersLoading(true);
      const response = await axiosInstance.get("/api/offerDetails");
      console.log("Offers API response:", response.data);

      if (response.data && Array.isArray(response.data)) {
        // Filter offers that have valid bannerImagePah
        const validOffers = response.data.filter(
          (offer) => offer.bannerImagePah && offer.bannerImagePah.trim() !== ""
        );
        setOffers(validOffers);
      } else {
        setOffers([]);
      }
    } catch (error) {
      console.error("Error fetching offers:", error);
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  };

  // Load offers on component mount
  useEffect(() => {
    fetchOffers();
  }, []);

  const sliderSettings = {
    slidesToShow: 5,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    arrows: false,
    dots: false,
    infinite: true,
    pauseOnHover: false,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 3 } },
      { breakpoint: 600, settings: { slidesToShow: 2 } },
      { breakpoint: 480, settings: { slidesToShow: 1 } },
    ],
  };

  return (
    <div className="login-container">
      {/* Travel-themed floating decorations */}
      <svg className="travel-decor travel-decor-cloud travel-decor-cloud-1" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <path d="M51.2 22.4c4.4 0 8-3.6 8-8s-3.6-8-8-8c-1.1 0-2.2.2-3.1.7C46.4 3.5 42 .8 37 .8c-6.6 0-12.1 4.7-13.4 10.8-1.1-.6-2.4-1-3.8-1C15.5 10.6 12 14.1 12 18.4c0 1.5.4 2.9 1.2 4.1-.4-.1-.8-.1-1.2-.1-4.4 0-8 3.6-8 8 0 .5 0 1 .1 1.5h47C51.1 31.6 51.2 31.5 51.2 31.5c2.2-.5 4-2.5 4-4.9 0-2.3-1.6-4.2-3.7-4.6 0 0-.1.4-.3.4z"/>
      </svg>
      <svg className="travel-decor travel-decor-cloud travel-decor-cloud-2" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <path d="M51.2 22.4c4.4 0 8-3.6 8-8s-3.6-8-8-8c-1.1 0-2.2.2-3.1.7C46.4 3.5 42 .8 37 .8c-6.6 0-12.1 4.7-13.4 10.8-1.1-.6-2.4-1-3.8-1C15.5 10.6 12 14.1 12 18.4c0 1.5.4 2.9 1.2 4.1-.4-.1-.8-.1-1.2-.1-4.4 0-8 3.6-8 8 0 .5 0 1 .1 1.5h47C51.1 31.6 51.2 31.5 51.2 31.5c2.2-.5 4-2.5 4-4.9 0-2.3-1.6-4.2-3.7-4.6 0 0-.1.4-.3.4z"/>
      </svg>
      <svg className="travel-decor travel-decor-cloud travel-decor-cloud-3" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <path d="M51.2 22.4c4.4 0 8-3.6 8-8s-3.6-8-8-8c-1.1 0-2.2.2-3.1.7C46.4 3.5 42 .8 37 .8c-6.6 0-12.1 4.7-13.4 10.8-1.1-.6-2.4-1-3.8-1C15.5 10.6 12 14.1 12 18.4c0 1.5.4 2.9 1.2 4.1-.4-.1-.8-.1-1.2-.1-4.4 0-8 3.6-8 8 0 .5 0 1 .1 1.5h47C51.1 31.6 51.2 31.5 51.2 31.5c2.2-.5 4-2.5 4-4.9 0-2.3-1.6-4.2-3.7-4.6 0 0-.1.4-.3.4z"/>
      </svg>
      <svg className="travel-decor travel-decor-plane" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
      <svg className="travel-decor travel-decor-balloon" viewBox="0 0 64 80" aria-hidden="true">
        <defs>
          <linearGradient id="balloonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff7a45"/>
            <stop offset="50%" stopColor="#fbbf24"/>
            <stop offset="100%" stopColor="#0ea5b7"/>
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="28" rx="24" ry="26" fill="url(#balloonGrad)"/>
        <path d="M14 38 Q32 60 50 38" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1"/>
        <path d="M22 52 L26 64 M42 52 L38 64 M32 54 L32 64" stroke="#64748b" strokeWidth="1" fill="none"/>
        <rect x="26" y="64" width="12" height="8" rx="2" fill="#8b5e3c"/>
      </svg>
      <svg className="travel-decor travel-decor-compass" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="32" cy="32" r="28"/>
        <circle cx="32" cy="32" r="3" fill="currentColor"/>
        <path d="M32 8 L36 32 L32 56 L28 32 Z" fill="currentColor" opacity="0.6"/>
        <path d="M8 32 L32 28 L56 32 L32 36 Z" opacity="0.4"/>
      </svg>

      {/* Header Section */}
      <div className="login-header">
        <div className="header-content" style={{ margin: "-13px auto" }}>
          <div className="company-info">
            <img
              src={`${process.env.PUBLIC_URL}/images/logo-1.jpg`}
              alt="Globosoft Logo"
              className="company-logo"
            />
            <div className="company-details">
              <h1 className="company-name">Globosoft</h1>
              <p className="company-tagline">Global Contracting Solutions</p>
            </div>
          </div>
          <div className="header-features">
            <div className="feature-item">
              <i className="fas fa-shield-alt"></i>
              <span>Secure Platform</span>
            </div>
            <div className="feature-item">
              <i className="fas fa-globe"></i>
              <span>Global Reach</span>
            </div>
            <div className="feature-item">
              <i className="fas fa-clock"></i>
              <span>24/7 Support</span>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content-row">
        {/* Left Content Section */}
        <div className="col-lg-8">
          {/* Hero Banner Section */}
          <div className="hero-section">
            <div
              id="offerSlider"
              className="carousel slide mb-4"
              data-bs-ride="carousel"
              style={{ position: "relative" }}
            >
              <div className="carousel-inner">
                {offersLoading ? (
                  <div className="carousel-item active">
                    <div
                      className="d-flex justify-content-center align-items-center"
                      style={{ height: "400px" }}
                    >
                      <div className="text-center">
                        <div
                          className="spinner-border text-primary mb-3"
                          role="status"
                        >
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted">Loading offers...</p>
                      </div>
                    </div>
                  </div>
                ) : offers.length > 0 ? (
                  offers.map((offer, index) => (
                    <div
                      key={offer.offerId}
                      className={`carousel-item ${index === 0 ? "active" : ""}`}
                    >
                      <img
                        src={offer.bannerImagePah}
                        className="d-block w-100"
                        alt={offer.title || `Special Offer ${index + 1}`}
                        style={{ height: "400px", objectFit: "cover" }}
                        onError={(e) => {
                          // Fallback to default image if API image fails to load
                          e.target.src = `${process.env.PUBLIC_URL}/images/01.png`;
                        }}
                      />
                      {/* Optional: Add overlay with offer title and description */}
                      <div className="carousel-caption d-none d-md-block">
                        <h5 className="text-white fw-bold">{offer.title}</h5>
                        <p className="text-white">
                          {offer.description}
                          {(offer.validityFrom || offer.validityTo) && (
                            <>
                              {" "}
                              ,{" "}
                              <small className="text-white">
                                {offer.validityFrom && offer.validityTo
                                  ? `${offer.validityFrom.split("T")[0]} - ${offer.validityTo.split("T")[0]
                                  }`
                                  : offer.validityFrom
                                    ? offer.validityFrom.split("T")[0]
                                    : offer.validityTo.split("T")[0]}
                              </small>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback to static images if no offers are available
                  <>
                    <div className="carousel-item active">
                      <img
                        src={`${process.env.PUBLIC_URL}/images/01.png`}
                        className="d-block w-100"
                        alt="Special Offer 1"
                        style={{ height: "400px", objectFit: "cover" }}
                      />
                    </div>
                    <div className="carousel-item">
                      <img
                        src={`${process.env.PUBLIC_URL}/images/04.png`}
                        className="d-block w-100"
                        alt="Special Offer 2"
                        style={{ height: "400px", objectFit: "cover" }}
                      />
                    </div>
                    <div className="carousel-item">
                      <img
                        src={`${process.env.PUBLIC_URL}/images/06.png`}
                        className="d-block w-100"
                        alt="Special Offer 3"
                        style={{ height: "400px", objectFit: "cover" }}
                      />
                    </div>
                    <div className="carousel-item">
                      <img
                        src={`${process.env.PUBLIC_URL}/images/07.png`}
                        className="d-block w-100"
                        alt="Special Offer 4"
                        style={{ height: "400px", objectFit: "cover" }}
                      />
                    </div>
                  </>
                )}
              </div>
              {/* Previous Button */}
              <button
                className="carousel-control-prev"
                type="button"
                data-bs-target="#offerSlider"
                data-bs-slide="prev"
                style={{
                  width: "auto",
                  height: "auto",
                  background: "none",
                  border: "none",
                  top: "50%",
                  transform: "translateY(-50%)",
                  left: "15px",
                  zIndex: 10,
                  cursor: "pointer",
                }}
              >
                <span
                  className="carousel-control-prev-icon"
                  aria-hidden="true"
                  style={{
                    fontSize: "32px",
                    fontWeight: "bold",
                    color: "white",
                    display: "block",
                    backgroundImage: "none",
                    lineHeight: "1",
                  }}
                >
                  &lt;
                </span>
                <span className="visually-hidden">Previous</span>
              </button>
              {/* Next Button */}
              <button
                className="carousel-control-next"
                type="button"
                data-bs-target="#offerSlider"
                data-bs-slide="next"
                style={{
                  width: "auto",
                  height: "auto",
                  background: "none",
                  border: "none",
                  top: "50%",
                  transform: "translateY(-50%)",
                  right: "15px",
                  zIndex: 10,
                  cursor: "pointer",
                }}
              >
                <span
                  className="carousel-control-next-icon"
                  aria-hidden="true"
                  style={{
                    fontSize: "32px",
                    fontWeight: "bold",
                    color: "white",
                    display: "block",
                    backgroundImage: "none",
                    lineHeight: "1",
                  }}
                >
                  &gt;
                </span>
                <span className="visually-hidden">Next</span>
              </button>
            </div>
          </div>

          {/* Value Proposition Section */}
          <div className="value-proposition">
            <div className="value-content">
              <h2>Streamline Your Contracting Operations</h2>
              <p>
                Access our comprehensive platform to manage hotel contracts,
                track performance, and optimize your business relationships with
                leading international hotel chains.
              </p>
              <div className="value-features">
                <div className="value-feature">
                  <i className="fas fa-chart-line"></i>
                  <span>Performance Analytics</span>
                </div>
                <div className="value-feature">
                  <i className="fas fa-handshake"></i>
                  <span>Contract Management</span>
                </div>
                <div className="value-feature">
                  <i className="fas fa-users"></i>
                  <span>Partner Network</span>
                </div>
              </div>
            </div>
          </div>

          {/* Offer Cards Section */}
          <div className="offers-section">
            <h3>Exclusive Offers & Services</h3>
            <div className="row g-3">
              <div className="col-md-3 visit">
                <div className="position-relative places">
                  <img
                    src={`${process.env.PUBLIC_URL}/images/01.png`}
                    alt="Special Offer 1"
                    className="img-fluid rounded"
                  />
                  <div className="offer-overlay">
                    <h4>Premium Deals</h4>
                    <p>Exclusive rates for our partners</p>
                  </div>
                </div>
              </div>
              <div className="col-md-3 visit">
                <div className="position-relative places">
                  <img
                    src={`${process.env.PUBLIC_URL}/images/02.png`}
                    alt="Special Offer 2"
                    className="img-fluid rounded"
                  />
                  <div className="offer-overlay">
                    <h4>Luxury Packages</h4>
                    <p>Curated experiences worldwide</p>
                  </div>
                </div>
              </div>
              <div className="col-md-6 visit">
                <div
                  className="position-relative places insurance-card"
                  onClick={handleInsuranceClick}
                >
                  <img
                    src={`${process.env.PUBLIC_URL}/images/03.png`}
                    alt="Travel Insurance"
                    className="img-fluid rounded"
                  />
                  <div className="overlay-text-new rounded">
                    <h3>Travel Insurance &ndash; Travel Smart</h3>
                    <p>
                      Enhance your travel experience with peace of mind. Add
                      insurance to your travel package and explore the world
                      worry free.
                    </p>
                    <div className="insurance-cta">
                      <i className="fas fa-external-link-alt"></i>
                      <span>Learn More</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Login Form Section */}
        <div
          className="login-form"
          style={{
            position: "sticky",
            top: "100px",
            alignSelf: "flex-start",
            zIndex: 100,
          }}
        >
          <div className="form-header">
            <div className="log">
              <img
                src={`${process.env.PUBLIC_URL}/images/logo-1.jpg`}
                alt="Globosoft Logo"
                className="img-fluid rounded login-logo"
              />
            </div>
            <h3>Welcome Back</h3>
            <p className="form-subtitle">Access your contracting dashboard</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">
                <i className="fas fa-user"></i>
                Username
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
            <div className="form-group">
              <label htmlFor="password">
                <i className="fas fa-lock"></i>
                Password
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
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="login-button">
              <i className="fas fa-sign-in-alt"></i>
              Sign In
            </button>
            <div className="form-links">
              <Link to="/register" className="register-link">
                <i className="fas fa-user-plus"></i>
                Create Account
              </Link>
              <button
                type="button"
                className="forgot-password-btn"
                data-bs-toggle="modal"
                data-bs-target="#exampleModal"
              >
                <i className="fas fa-key"></i>
                Forgot Password?
              </button>
            </div>
          </form>

          <div className="form-footer">
            <div className="security-notice">
              <i className="fas fa-shield-alt"></i>
              <span>Your data is protected with enterprise-grade security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <div
        className="modal fade"
        id="exampleModal"
        tabIndex="-1"
        aria-labelledby="exampleModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="exampleModalLabel">
                <i className="fas fa-key"></i>
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
              <div className="inner">
                <p className="modal-description">
                  Enter your email and username to receive password reset
                  instructions.
                </p>
                <form
                  id="changePass"
                  onSubmit={handleForgetPasswordSubmit}
                  autoComplete="off"
                >
                  <div className="form-holder active mb-3">
                    <label
                      className="control-label col-xs-12 col-sm-3 no-padding-right"
                      htmlFor="forgetmail"
                    >
                      <span className="text-red-500">*</span> Email Address:
                    </label>
                    <input
                      type="email"
                      id="forgetmail"
                      className="form-control forgetmail"
                      name="forgetmail"
                      placeholder="Enter your email address"
                      value={forgetEmail}
                      onChange={(e) => setForgetEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      {error}
                    </div>
                  )}
                  <div className="form-holder mb-3">
                    <label
                      className="control-label col-xs-12 col-sm-3 no-padding-right"
                      htmlFor="userCode"
                    >
                      <span className="text-red-500">*</span> Username:
                    </label>
                    <input
                      type="text"
                      id="userCode"
                      className="form-control userCode"
                      name="userCode"
                      placeholder="Enter your username"
                      value={forgetUsername}
                      onChange={(e) => setForgetUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-login">
                    <input
                      type="submit"
                      value="Send Reset Link"
                      id="submit"
                      className="btn btn-warning w-100"
                    />
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Partners Section */}
      <div className="partners-section">
        <div className="partners-content">
          <h3>International Chains We Are Connected With</h3>
          <p>
            Explore Our Collections Of 5000+ Luxury Hotels And 500000+ Hotels
            Worldwide Clubbed With Local Attractions
          </p>
          <div className="partners-stats">
            <div className="stat-item">
              <span className="stat-number">5000+</span>
              <span className="stat-label">Luxury Hotels</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">500K+</span>
              <span className="stat-label">Global Hotels</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">150+</span>
              <span className="stat-label">Countries</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hotel Chains Slider */}
      <div className="customers-section">
        <Slider className="brand-slider" {...sliderSettings}>
          <div>
            <img
              src={`${process.env.PUBLIC_URL}/images/marqueeImages/Holiday-Inn-logo.png`}
              className="down-marquee-images"
              alt="Holiday Inn Logo"
            />
          </div>
          <div>
            <img
              src={`${process.env.PUBLIC_URL}/images/marqueeImages/Accor-logo.png`}
              className="down-marquee-images"
              alt="Accor Logo"
            />
          </div>
          <div>
            <img
              src={`${process.env.PUBLIC_URL}/images/marqueeImages/Atlantis.png`}
              className="down-marquee-images"
              alt="Atlantis Logo"
            />
          </div>
          <div>
            <img
              src={`${process.env.PUBLIC_URL}/images/marqueeImages/Hilton-logo.png`}
              className="down-marquee-images"
              alt="Hilton Logo"
            />
          </div>
          <div>
            <img
              src={`${process.env.PUBLIC_URL}/images/marqueeImages/Hyatt-Logo.png`}
              className="down-marquee-images"
              alt="Hyatt Logo"
            />
          </div>
          <div>
            <img
              src={`${process.env.PUBLIC_URL}/images/marqueeImages/Sheraton-logo.png`}
              className="down-marquee-images"
              alt="Sheraton Logo"
            />
          </div>
        </Slider>
      </div>
    </div>
  );
};

export default Login;
