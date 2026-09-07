import React from "react";

/**
 * The five built-in hotel-promotion flyer designs.
 *
 * These are original layouts written from scratch — deliberately not traced
 * from stock/Pinterest artwork, which would carry someone else's licence into
 * the product. They cover the styles a hotel promo usually needs: a classic
 * curved-band poster, a bold diagonal split, a quiet minimal frame, a dark
 * luxury treatment and a bright coastal one.
 *
 * Every template renders the SAME `data` object, so switching template never
 * loses what the user typed. Each draws onto a fixed 794x1123 canvas (A4 at
 * 96dpi) and the page scales that with a CSS transform — laying out against a
 * known size is what keeps a thumbnail and the full preview identical.
 */

export const FLYER_CANVAS = { width: 794, height: 1123 };

/** Values a brand-new flyer starts from, so a template never previews empty. */
export const EMPTY_FLYER = {
  templateId: "royal-wave",
  logoText: "DESERT BEDS",
  hotelName: "The Royal Luxury Hotel",
  headline: "Summer Escape Offer",
  description:
    "Stay with us this season and enjoy spacious rooms, sea-facing balconies and a complimentary breakfast for two.",
  price: "AED 299",
  priceNote: "per night",
  validFrom: "",
  validTo: "",
  services: ["Swimming Pool", "Catering", "Free WiFi", "Beach View"],
  phone: "+971 56 326 9000",
  email: "info@desertbeds.com",
  website: "www.desertbeds.com",
  // Placeholders only — the operator replaces these with their own URLs.
  // Deliberately NOT /images/main-slider.jpg: that asset is 15MB, which stalls
  // the preview and every thumbnail on the list.
  photo: "/images/02.png",
  photo2: "/images/hotelrooms/1.jpg",
  photo3: "/images/hotelrooms/3.jpg",
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const validity = (d) => {
  if (d.validFrom && d.validTo) return `Valid ${d.validFrom} – ${d.validTo}`;
  if (d.validFrom) return `Valid from ${d.validFrom}`;
  if (d.validTo) return `Valid until ${d.validTo}`;
  return "";
};

const services = (d) => (Array.isArray(d.services) ? d.services.filter(Boolean) : []);

/* ── 1. Royal Wave — curved sand bands over a hero photo ─────────────────── */

function RoyalWave({ d }) {
  return (
    <div className="pf-canvas pf-t1">
      <div className="pf-t1-logo">{d.logoText}</div>

      <div className="pf-t1-hero">
        <img src={d.photo} alt="" />
        <div className="pf-t1-hero-shade" />
        <svg className="pf-t1-wave-top" viewBox="0 0 794 120" preserveAspectRatio="none">
          <path d="M0,0 H794 V44 C560,120 300,-6 0,86 Z" />
        </svg>
        <svg className="pf-t1-wave-bottom" viewBox="0 0 794 130" preserveAspectRatio="none">
          <path d="M0,130 H794 V38 C540,-24 250,132 0,52 Z" />
        </svg>
        <div className="pf-t1-hero-copy">
          <h1>{d.hotelName}</h1>
          <p>{d.description}</p>
        </div>
      </div>

      <div className="pf-t1-circles">
        <span style={{ backgroundImage: `url(${d.photo2})` }} />
        <span style={{ backgroundImage: `url(${d.photo3})` }} />
        <span style={{ backgroundImage: `url(${d.photo})` }} />
      </div>

      <div className="pf-t1-cols">
        <div>
          <h2>{d.headline}</h2>
          <p>{d.description}</p>
          <div className="pf-t1-price">
            <strong>{d.price}</strong>
            <span>{d.priceNote}</span>
          </div>
          {validity(d) && <div className="pf-t1-valid">{validity(d)}</div>}
        </div>
        <div>
          <h2>Services</h2>
          <ul>
            {services(d).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pf-t1-foot">
        <div>
          <h3>For More Info</h3>
          <p>{d.phone}</p>
        </div>
        <div className="pf-t1-foot-right">
          <h3>For Booking</h3>
          <p>{d.email}</p>
          <p>{d.website}</p>
        </div>
      </div>
    </div>
  );
}

/* ── 2. Bold Split — diagonal photo against a solid colour field ─────────── */

function BoldSplit({ d }) {
  return (
    <div className="pf-canvas pf-t2">
      <div className="pf-t2-photo" style={{ backgroundImage: `url(${d.photo})` }} />
      <div className="pf-t2-panel">
        <div className="pf-t2-logo">{d.logoText}</div>
        <h1>{d.hotelName}</h1>
        <div className="pf-t2-rule" />
        <h2>{d.headline}</h2>
        <p>{d.description}</p>

        <ul className="pf-t2-services">
          {services(d).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="pf-t2-badge">
        <span>from</span>
        <strong>{d.price}</strong>
        <span>{d.priceNote}</span>
      </div>

      <div className="pf-t2-foot">
        {validity(d) && <span className="pf-t2-valid">{validity(d)}</span>}
        <span>{d.phone}</span>
        <span>{d.email}</span>
        <span>{d.website}</span>
      </div>
    </div>
  );
}

/* ── 3. Minimal Frame — quiet, centred, lots of white ────────────────────── */

function MinimalFrame({ d }) {
  return (
    <div className="pf-canvas pf-t3">
      <div className="pf-t3-frame">
        <div className="pf-t3-logo">{d.logoText}</div>
        <div className="pf-t3-kicker">{d.headline}</div>
        <h1>{d.hotelName}</h1>
        <div className="pf-t3-hr" />

        <div className="pf-t3-photo" style={{ backgroundImage: `url(${d.photo})` }} />

        <p className="pf-t3-desc">{d.description}</p>

        <div className="pf-t3-price">
          <strong>{d.price}</strong>
          <span>{d.priceNote}</span>
        </div>
        {validity(d) && <div className="pf-t3-valid">{validity(d)}</div>}

        <div className="pf-t3-services">
          {services(d).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <i>·</i>}
              <span>{s}</span>
            </React.Fragment>
          ))}
        </div>

        <div className="pf-t3-hr pf-t3-hr-thin" />
        <div className="pf-t3-contact">
          <span>{d.phone}</span>
          <span>{d.email}</span>
          <span>{d.website}</span>
        </div>
      </div>
    </div>
  );
}

/* ── 4. Dark Luxe — near-black with gold rules ───────────────────────────── */

function DarkLuxe({ d }) {
  return (
    <div className="pf-canvas pf-t4">
      <div className="pf-t4-photo">
        <img src={d.photo} alt="" />
        <div className="pf-t4-fade" />
      </div>

      <div className="pf-t4-body">
        <div className="pf-t4-logo">{d.logoText}</div>
        <div className="pf-t4-kicker">{d.headline}</div>
        <h1>{d.hotelName}</h1>
        <div className="pf-t4-rule" />
        <p>{d.description}</p>

        <div className="pf-t4-price">
          <strong>{d.price}</strong>
          <span>{d.priceNote}</span>
        </div>
        {validity(d) && <div className="pf-t4-valid">{validity(d)}</div>}

        <ul className="pf-t4-services">
          {services(d).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="pf-t4-foot">
        <span>{d.phone}</span>
        <span>{d.email}</span>
        <span>{d.website}</span>
      </div>
    </div>
  );
}

/* ── 5. Coastal Bright — rounded cards, sand + teal ──────────────────────── */

function CoastalBright({ d }) {
  return (
    <div className="pf-canvas pf-t5">
      <div className="pf-t5-top">
        <span className="pf-t5-logo">{d.logoText}</span>
        {validity(d) && <span className="pf-t5-valid">{validity(d)}</span>}
      </div>

      <div className="pf-t5-photo" style={{ backgroundImage: `url(${d.photo})` }}>
        <div className="pf-t5-pill">
          <strong>{d.price}</strong>
          <span>{d.priceNote}</span>
        </div>
      </div>

      <h1>{d.hotelName}</h1>
      <div className="pf-t5-kicker">{d.headline}</div>
      <p className="pf-t5-desc">{d.description}</p>

      <div className="pf-t5-chips">
        {services(d).map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>

      <div className="pf-t5-thumbs">
        <span style={{ backgroundImage: `url(${d.photo2})` }} />
        <span style={{ backgroundImage: `url(${d.photo3})` }} />
      </div>

      <div className="pf-t5-foot">
        <div>
          <b>Book now</b>
          <span>{d.phone}</span>
        </div>
        <div className="pf-t5-foot-right">
          <span>{d.email}</span>
          <span>{d.website}</span>
        </div>
      </div>
    </div>
  );
}

/* ── registry ────────────────────────────────────────────────────────────── */

export const FLYER_TEMPLATES = [
  {
    id: "royal-wave",
    name: "Royal Wave",
    blurb: "Curved sand bands over a full-width hero photo",
    Component: RoyalWave,
  },
  {
    id: "bold-split",
    name: "Bold Split",
    blurb: "Diagonal photo against a solid colour field",
    Component: BoldSplit,
  },
  {
    id: "minimal-frame",
    name: "Minimal Frame",
    blurb: "Quiet, centred layout with generous white space",
    Component: MinimalFrame,
  },
  {
    id: "dark-luxe",
    name: "Dark Luxe",
    blurb: "Near-black with gold rules, for premium stays",
    Component: DarkLuxe,
  },
  {
    id: "coastal-bright",
    name: "Coastal Bright",
    blurb: "Rounded cards in sand and teal, light and airy",
    Component: CoastalBright,
  },
];

export const getTemplate = (id) =>
  FLYER_TEMPLATES.find((t) => t.id === id) || FLYER_TEMPLATES[0];

/**
 * Renders a flyer at an arbitrary scale. The canvas is always drawn at its
 * true 794x1123 and then transformed, so a 0.18 thumbnail and a 0.62 preview
 * are the same artwork rather than two layouts that can disagree.
 */
export function FlyerCanvas({ data, scale = 1 }) {
  const { Component } = getTemplate(data.templateId);
  return (
    <div
      className="pf-canvas-scaler"
      style={{
        width: FLYER_CANVAS.width * scale,
        height: FLYER_CANVAS.height * scale,
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <Component d={data} />
      </div>
    </div>
  );
}
