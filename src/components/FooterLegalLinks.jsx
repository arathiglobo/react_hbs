import React, { useEffect, useState } from "react";
import "../styles/FooterLegalLinks.css";

/**
 * The "Terms & Conditions · Contact Details" pair that sits in the middle of
 * every dashboard footer, plus the two panels they open.
 *
 * Rendered as a bare inline group rather than its own bar, so it can be dropped
 * straight into whatever footer a dashboard already has and land in the centre
 * (the existing footers are flex + space-between, so a middle child centres
 * itself). Link colour is inherited, which keeps it legible on both the white
 * `.adm-foot` and the orange `.dash-footer` band.
 *
 * The panels reuse the look of the About Us panel on the login page, but with
 * their own `dbf-` class family and tokens — the login styles are scoped to
 * `.lg-shell` and their variables would not resolve out here.
 */

/* ── Terms & Conditions ─────────────────────────────────────────────────── */

const TERMS_INTRO =
  "By accessing or using the Desert Beds LLC booking platform, website, API connectivity, or related services, the registered travel agency, tour operator, OTA, corporate travel company, or reseller (“Client”) agrees to be bound by these Terms & Conditions.";

const TERMS_SECTIONS = [
  {
    title: "Scope of Services",
    body: "Desert Beds LLC operates as a B2B travel wholesaler, Bed Bank, Online Travel Agency (OTA), and Destination Management Company (DMC), providing accommodation, transfers, tours, excursions, transportation, visa assistance, and other travel-related services through its platform and contracted suppliers.",
  },
  {
    title: "B2B Use Only",
    body: "Services are intended exclusively for licensed travel professionals and authorized business partners. Direct resale to the public may be subject to separate agreements and applicable regulations.",
  },
  {
    title: "Booking Confirmation",
    body: "All reservations are subject to availability and confirmation from the supplier. A booking is considered confirmed only upon issuance of a booking confirmation number by Desert Beds LLC.",
  },
  {
    title: "Rates and Payments",
    body: "All rates displayed are confidential, net, and intended solely for the Client’s use. Full payment must be received before travel unless a credit facility has been approved in writing. Desert Beds LLC reserves the right to cancel bookings for non-payment or payment disputes.",
  },
  {
    title: "Amendments and Cancellations",
    body: "Changes and cancellations are subject to the specific rules displayed at the time of booking. Cancellation fees, no-show charges, and supplier penalties may apply and may amount to 100% of the booking value. Refundable and nonrefundable are displayed at the time of booking.",
  },
  {
    title: "Refund Policy",
    body: "Approved refunds will be processed after receipt of funds from the respective supplier in writing. Processing times may vary depending on supplier policies and banking procedures.",
  },
  {
    title: "Supplier Responsibility",
    body: "Hotels, airlines, transfer companies, excursion providers, and other suppliers are independent contractors. Desert Beds LLC acts solely as an intermediary and shall not be liable for service deficiencies, overbookings, delays, cancellations, force majeure events, or actions of suppliers.",
  },
  {
    title: "Client Responsibilities",
    body: "The Client is responsible for ensuring the accuracy of passenger information, travel documents, visas, health requirements, and compliance with destination regulations. Any costs arising from incorrect information shall be borne by the Client.",
  },
  {
    title: "Privacy & Confidentiality",
    body: "All rates, inventory, contracts, login credentials, API content, and commercial information provided by Desert Beds LLC are confidential and may not be disclosed to third parties without written consent.",
  },
  {
    title: "System Usage",
    body: "Clients shall not misuse the platform, attempt unauthorized access, perform automated scraping, manipulate rates, or engage in fraudulent activity. Desert Beds LLC reserves the right to suspend accounts without notice in case of suspected abuse.",
  },
  {
    title: "Limitation of Liability",
    body: "The maximum liability of Desert Beds LLC for any claim shall not exceed the amount paid for the specific booking giving rise to the claim. Under no circumstances shall Desert Beds LLC be liable for indirect, consequential, or loss-of-profit damages.",
  },
  {
    title: "Force Majeure",
    body: "Desert Beds LLC shall not be liable for failure to perform obligations resulting from events beyond its reasonable control, including natural disasters, pandemics, war, government restrictions, strikes, supplier insolvency, or technical failures.",
  },
  {
    title: "Governing Law",
    body: "These Terms & Conditions shall be governed by the laws of the United Arab Emirates. Any disputes shall be subject to the exclusive jurisdiction of the Courts of Sharjah, UAE.",
  },
  {
    title: "Acceptance",
    body: "By registering, accessing, or making bookings through Desert Beds LLC, the Client acknowledges that it has read, understood, and accepted these Terms & Conditions.",
  },
  {
    title: "Agreements & Payment mode",
    body: "Each travel partner will enter into a separate agreement with Desert Beds LLC, tailored to the specific products, services and commercial requirements selected by the partner. Subject to the applicable agreement, partners may access a range of flexible payment facilities, including online and offline account top-ups, card payments through our secure payment gateway, bank transfers, and other locally accepted payment methods, where available and permitted under the applicable laws and regulations of the country. The availability, limits, processing terms and applicable fees for each payment method will be determined by Desert Beds LLC and specified in the relevant partner agreement.",
  },
];

/* ── Contact details ────────────────────────────────────────────────────── */

const CONTACT_BLOCKS = [
  {
    title: "Binoy Ouseph",
    rows: [
      {
        label: "Mobile & WhatsApp",
        value: "+971 56 175 2667",
        href: "tel:+971561752667",
      },
      { label: "Email", value: "info@desertbeds.com", href: "mailto:info@desertbeds.com" },
    ],
  },
  {
    title: "Operations",
    rows: [
      { label: "Mobile", value: "+971 56 326 9000", href: "tel:+971563269000" },
      {
        label: "Email",
        value: "support@desertbeds.com",
        href: "mailto:support@desertbeds.com",
      },
    ],
  },
  {
    title: "Finance",
    rows: [
      {
        label: "Email",
        value: "finance@desertbeds.com",
        href: "mailto:finance@desertbeds.com",
      },
    ],
  },
  {
    title: "Sales",
    rows: [
      { label: "Email", value: "sales@desertbeds.com", href: "mailto:sales@desertbeds.com" },
    ],
  },
  {
    title: "Bank Details",
    rows: [
      { label: "Bank", value: "Mashreq Neo Biz" },
      { label: "Account Number", value: "019102175819" },
      { label: "IBAN", value: "AE430330000019102175819" },
    ],
  },
];

/* ── Panel shell ────────────────────────────────────────────────────────── */

function Panel({ eyebrow, title, tagline, onClose, children }) {
  // Escape closes, bound only while open so the page is not listening for keys
  // it has no use for the rest of the time.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="dbf-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="dbf-panel" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="dbf-close"
          onClick={onClose}
          aria-label="Close"
        >
          <i className="fas fa-times"></i>
        </button>

        <header className="dbf-head">
          <p className="dbf-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {tagline && <p className="dbf-tagline">{tagline}</p>}
        </header>

        {/* Only the body scrolls — the title and close button stay put. */}
        <div className="dbf-body">{children}</div>
      </div>
    </div>
  );
}

/* ── The footer links themselves ────────────────────────────────────────── */

export default function FooterLegalLinks() {
  const [open, setOpen] = useState(null); // "terms" | "contact" | null
  const close = () => setOpen(null);

  return (
    <>
      <div className="dbf-links">
        <button type="button" onClick={() => setOpen("terms")}>
          Terms and Conditions
        </button>
        <span className="dbf-sep" aria-hidden="true">
          |
        </span>
        <button type="button" onClick={() => setOpen("contact")}>
          Contact Details
        </button>
      </div>

      {open === "terms" && (
        <Panel
          eyebrow="Desert Beds LLC"
          title="Terms & Conditions"
          tagline="Effective Date: September 2026"
          onClose={close}
        >
          <p>{TERMS_INTRO}</p>

          {TERMS_SECTIONS.map((section, i) => (
            <section className="dbf-clause" key={section.title}>
              <h3>
                <span className="dbf-clause-no">{i + 1}.</span>
                {section.title}
              </h3>
              <p>{section.body}</p>
            </section>
          ))}

          <div className="dbf-signoff">
            <strong>Desert Beds LLC</strong>
            <span>Sharjah Media City (SHAMS), Sharjah, United Arab Emirates</span>
            <span>
              Website:{" "}
              <a
                href="https://www.desertbeds.com"
                target="_blank"
                rel="noreferrer"
              >
                www.desertbeds.com
              </a>
            </span>
            <span>
              Email:{" "}
              <a href="mailto:support@desertbeds.com">support@desertbeds.com</a>
            </span>
          </div>
        </Panel>
      )}

      {open === "contact" && (
        <Panel
          eyebrow="Desert Beds LLC"
          title="Contact Details"
          tagline="Formation No. 2647237 · Sharjah Media City, United Arab Emirates"
          onClose={close}
        >
          {CONTACT_BLOCKS.map((block) => (
            <section className="dbf-contact" key={block.title}>
              <h3>{block.title}</h3>
              <dl>
                {block.rows.map((row) => (
                  <React.Fragment key={row.label + row.value}>
                    <dt>{row.label}</dt>
                    <dd>
                      {row.href ? (
                        <a href={row.href}>{row.value}</a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>
          ))}
        </Panel>
      )}
    </>
  );
}
