import React from "react";

/**
 * The nine built-in hotel-promotion flyer designs.
 *
 * These are original layouts written from scratch — deliberately not traced
 * from stock/Pinterest artwork, which would carry someone else's licence into
 * the product. Designs 6-9 follow the composition of reference flyers the
 * client supplied (arched hero, swoosh-cut hero, monogram masthead, split-photo
 * offer poster); the shapes, type and colour here are ours, and no logo, photo
 * or wording was taken from those references.
 *
 * Between them they cover the styles a hotel promo usually needs: a classic
 * curved-band poster, a bold diagonal split, a quiet minimal frame, a dark
 * luxury treatment, a bright coastal one, and four full-bleed posters.
 *
 * Every template renders the SAME `data` object, so switching template never
 * loses what the user typed. Each draws onto a fixed 794x1123 canvas (A4 at
 * 96dpi) and the page scales that with a CSS transform — laying out against a
 * known size is what keeps a thumbnail and the full preview identical.
 *
 * EXPORT CONSTRAINT: these designs are rasterised by html2canvas for the PNG /
 * PDF download, and html2canvas paints only a subset of CSS. So photos are
 * drawn as `background-image: cover` divs (it ignores `object-fit`), shapes
 * are inline SVG with a `fill` ATTRIBUTE (it serialises the SVG without our
 * stylesheet, so a CSS `fill` would come out black), and nothing here uses
 * `clip-path` or `filter` (both silently skipped). Keep to those rules or the
 * downloaded flyer stops matching what the operator saw on screen.
 *
 * The other half of that rule: a shape SVG must COVER THE WHOLE ARTBOARD —
 * `inset: 0`, `viewBox="0 0 794 1123"`, with the shape drawn at absolute
 * artboard coordinates. A part-height SVG parked partway down the canvas is
 * dropped from the raster (it still shows on screen, which is what makes the
 * bug easy to miss). Stack such a shape with z-index instead of shrinking it.
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
  // Used by the four poster designs. Optional everywhere: a flyer saved before
  // these existed still renders, it just leaves the slot out.
  tagline: "Comfort. Elegance. Warmth.",
  badgeText: "Deluxe Room",
  address: "Al Wasl Road, Jumeirah 1, Dubai, UAE",
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

/* Colours that inline SVG shapes are filled with. They live here, as literals
   passed to a `fill` attribute, because a CSS `fill:` is lost when the flyer is
   rasterised for download — see the EXPORT CONSTRAINT note at the top. */
const SAND = "#f4e3b8"; // Royal Wave bands
const DEEP_TEAL = "#123244"; // Bold Split field, matches .pf-t2's background

/* ── 1. Royal Wave — curved sand bands over a hero photo ─────────────────── */

function RoyalWave({ d }) {
  return (
    <div className="pf-canvas pf-t1">
      <div className="pf-t1-logo">{d.logoText}</div>

      <div className="pf-t1-hero">
        <div className="pf-t1-hero-img" style={{ backgroundImage: `url(${d.photo})` }} />
        <div className="pf-t1-hero-shade" />
        <div className="pf-t1-hero-copy">
          <h1>{d.hotelName}</h1>
          <p>{d.description}</p>
        </div>
      </div>

      {/* The two sand bands that curve into the hero. Drawn on their own
          full-artboard canvases (see the EXPORT CONSTRAINT note) and stacked
          over the photo with z-index, rather than sized to the hero. */}
      <svg className="pf-t1-waves" viewBox="0 0 794 1123" preserveAspectRatio="none">
        <path d="M0,95 H794 V139 C560,215 300,89 0,181 Z" fill={SAND} />
        <path d="M0,527 H794 V435 C540,373 250,529 0,449 Z" fill={SAND} />
      </svg>

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
      {/* The diagonal is painted OVER the photo rather than clipped out of it:
          the cut runs from 52% down the left edge to 34% down the right, and
          the fill is .pf-t2's own colour, so the edge looks identical while
          staying inside what the PNG/PDF export can draw. */}
      <svg className="pf-t2-cut" viewBox="0 0 794 1123" preserveAspectRatio="none">
        <path d="M0,584 L794,382 L794,1123 L0,1123 Z" fill={DEEP_TEAL} />
      </svg>
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
        <div className="pf-t4-photo-img" style={{ backgroundImage: `url(${d.photo})` }} />
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

/* ── line icons ──────────────────────────────────────────────────────────── */

/**
 * The little stroked icons the four poster designs put beside a service.
 *
 * Hand-written rather than pulled from react-icons because every stroke colour
 * has to be an ATTRIBUTE: an icon whose colour came from CSS (or from
 * `currentColor`) comes out black once the flyer is rasterised for download.
 */
const ICON_PATHS = {
  bed: (
    <>
      <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 18h18M3 14h18" />
      <path d="M7 10V8h4v2" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 9a15 15 0 0 1 19 0" />
      <path d="M5.5 12.5a10.5 10.5 0 0 1 13 0" />
      <path d="M8.5 16a6 6 0 0 1 7 0" />
      <path d="M12 19.5h.01" />
    </>
  ),
  shower: (
    <>
      <path d="M4 20V7a3 3 0 0 1 6 0" />
      <path d="M6 7h13" />
      <path d="M9 12v1.5M13 12v1.5M17 12v1.5M11 16v1.5M15 16v1.5" />
    </>
  ),
  pool: (
    <>
      <path d="M2 16.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 11.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M7 12V5a2 2 0 0 1 4 0M13 12V5a2 2 0 0 1 4 0" />
    </>
  ),
  dining: (
    <>
      <path d="M7 3v18" />
      <path d="M5 3v4a2 2 0 0 0 4 0V3" />
      <path d="M17 3c-2 2-2 7 0 9v9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" />
      <path d="M9.5 12l1.8 1.8L15 10.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14.5" r="4" />
      <path d="M11 11.5L20 3" />
      <path d="M16.5 6.5l2.2 2.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s7-6.2 7-11.3A7 7 0 0 0 5 10.2c0 5.1 7 11.3 7 11.3z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  phone: (
    <path d="M5 3.5h3.6l1.8 4.5-2.3 1.4a12.5 12.5 0 0 0 5.5 5.5l1.4-2.3 4.5 1.8V18a2.5 2.5 0 0 1-2.7 2.5A16.5 16.5 0 0 1 2.5 6.2 2.5 2.5 0 0 1 5 3.5z" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.6 2.7 2.6 14.3 0 17M12 3.5c-2.6 2.7-2.6 14.3 0 17" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.6 7l8.4 5.6L20.4 7" />
    </>
  ),
  star: (
    <path d="M12 3.8l2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7L6.9 19l1-5.6-4-4 5.6-.8z" />
  ),
};

/** Cycled through when a design shows more services than it has named icons. */
const ICON_CYCLE = ["bed", "wifi", "shower", "pool", "dining", "shield", "clock", "key"];

function Icon({ name, color, size = 30, width = 1.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name] || ICON_PATHS.star}
    </svg>
  );
}

/* ── 6. Grand Arc — navy and gold poster with an arched hero ─────────────── */

const NAVY = "#0f2b4a";
const GOLD = "#c2984f";
const CREAM = "#f3ece0";

function GrandArc({ d }) {
  const feats = services(d).slice(0, 3);
  return (
    <div className="pf-canvas pf-t6">
      <div className="pf-t6-hero" style={{ backgroundImage: `url(${d.photo})` }} />
      <div className="pf-t6-veil" />

      <div className="pf-t6-head">
        <div className="pf-t6-logo">{d.logoText}</div>
        <h1>{d.headline}</h1>
        <div className="pf-t6-hotel">{d.hotelName}</div>
        <div className="pf-t6-diamond">
          <span />
        </div>
        {d.tagline && <p className="pf-t6-tagline">{d.tagline}</p>}
      </div>

      {d.badgeText && (
        <div className="pf-t6-badge">
          <Icon name="bed" color={GOLD} size={30} />
          <strong>{d.badgeText}</strong>
        </div>
      )}

      {/* The arch that lifts the navy field into the photo. */}
      <svg className="pf-t6-arc" viewBox="0 0 794 1123" preserveAspectRatio="none">
        <path d="M0,690 V554 C240,482 554,482 794,554 V690 Z" fill={NAVY} />
        <path d="M0,554 C240,482 554,482 794,554" fill="none" stroke={GOLD} strokeWidth="4" />
      </svg>

      <div className="pf-t6-feats">
        {feats.map((s, i) => (
          <div key={s} className="pf-t6-feat">
            <Icon name={ICON_CYCLE[i]} color={GOLD} size={34} />
            <span>{s}</span>
          </div>
        ))}
      </div>

      <div className="pf-t6-strip">
        {[d.photo, d.photo2, d.photo3].map((src, i) => (
          <span key={i} style={{ backgroundImage: `url(${src})` }} />
        ))}
      </div>

      <div className="pf-t6-cta">
        <div className="pf-t6-cta-left">
          <strong>{d.price}</strong>
          <span>{d.priceNote}</span>
        </div>
        <div className="pf-t6-cta-mid">
          <h2>Book your stay today</h2>
          <p>{validity(d) || d.description}</p>
        </div>
        <div className="pf-t6-cta-right">
          <Icon name="phone" color={GOLD} size={26} />
          <span>{d.phone}</span>
        </div>
      </div>

      <div className="pf-t6-foot">
        <span>
          <Icon name="globe" color={GOLD} size={17} width={1.7} />
          {d.website}
        </span>
        <em />
        <span>
          <Icon name="mail" color={GOLD} size={17} width={1.7} />
          {d.email}
        </span>
      </div>
    </div>
  );
}

/* ── 7. Estate Card — light poster with a swoosh hero and a dark deck ────── */

const CHARCOAL = "#37383a";
const ROSE = "#b9776a";

function EstateCard({ d }) {
  const feats = services(d).slice(0, 6);
  return (
    <div className="pf-canvas pf-t7">
      <div className="pf-t7-hero" style={{ backgroundImage: `url(${d.photo})` }} />
      {/* White swoosh cutting the hero away from the headline column. */}
      <svg className="pf-t7-swoosh" viewBox="0 0 794 1123" preserveAspectRatio="none">
        <path d="M794,0 H470 C560,150 560,320 430,470 H794 Z" fill="#ffffff" />
      </svg>

      <div className="pf-t7-logo">{d.logoText}</div>

      <div className="pf-t7-head">
        <div className="pf-t7-kicker">{d.headline}</div>
        <h1>{d.hotelName}</h1>
        {d.badgeText && <span className="pf-t7-tag">{d.badgeText}</span>}
      </div>

      <div className="pf-t7-deck">
        <div className="pf-t7-deck-photo" style={{ backgroundImage: `url(${d.photo2})` }} />
        <div className="pf-t7-deck-copy">
          <span>Only for</span>
          <strong>{d.price}</strong>
          <em>{d.priceNote}</em>
          <p>{d.description}</p>
        </div>
      </div>

      <div className="pf-t7-band" />

      <div className="pf-t7-circles">
        {[d.photo2, d.photo, d.photo3].map((src, i) => (
          <span key={i} style={{ backgroundImage: `url(${src})` }} />
        ))}
      </div>

      <div className="pf-t7-lower">
        <div>
          <span className="pf-t7-label">Highlights</span>
          <ul className="pf-t7-feats">
            {feats.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="pf-t7-addr">
          <p>{d.address}</p>
          <p>{d.phone}</p>
          <p>{d.website}</p>
          {validity(d) && <p className="pf-t7-valid">{validity(d)}</p>}
        </div>
      </div>

      {d.tagline && <div className="pf-t7-note">{d.tagline}</div>}

      <div className="pf-t7-foot">{d.email}</div>
    </div>
  );
}

/* ── 8. Noir Gold — near-black and gold, monogram masthead ───────────────── */

const NOIR = "#1c1410";
const GOLD_DEEP = "#d3a44a";

function NoirGold({ d }) {
  const feats = services(d).slice(0, 4);
  const monogram = (d.logoText || "H").trim().charAt(0).toUpperCase();
  return (
    <div className="pf-canvas pf-t8">
      <div className="pf-t8-mast">
        <div className="pf-t8-monogram">{monogram}</div>
        <div className="pf-t8-name">{d.logoText}</div>
        {d.tagline && <div className="pf-t8-sub">{d.tagline}</div>}
      </div>

      <div className="pf-t8-body">
        <div className="pf-t8-copy">
          <h1>{d.headline}</h1>
          <p>{d.description}</p>
          <div className="pf-t8-rule" />
          <div className="pf-t8-price">
            <strong>{d.price}</strong>
            <span>{d.priceNote}</span>
          </div>
          {validity(d) && <div className="pf-t8-valid">{validity(d)}</div>}
        </div>
        <div className="pf-t8-photo" style={{ backgroundImage: `url(${d.photo})` }} />
      </div>

      <div className="pf-t8-card">
        {feats.map((s, i) => (
          <div key={s} className="pf-t8-feat">
            <span className="pf-t8-ring">
              <Icon name={ICON_CYCLE[i]} color={GOLD_DEEP} size={26} />
            </span>
            <span className="pf-t8-feat-label">{s}</span>
          </div>
        ))}
      </div>

      <div className="pf-t8-cta">
        <Icon name="clock" color={NOIR} size={24} width={1.8} />
        <strong>Book Here</strong>
      </div>

      <div className="pf-t8-foot">
        <div>
          <Icon name="pin" color={GOLD_DEEP} size={26} />
          <p>{d.address}</p>
        </div>
        <div>
          <Icon name="phone" color={GOLD_DEEP} size={26} />
          <p>
            {d.phone}
            <br />
            {d.website}
          </p>
        </div>
      </div>

      <div className="pf-t8-bar" />
    </div>
  );
}

/* ── 9. Teal Deal — offer poster with split photos and a discount block ──── */

const TEAL = "#0d7b73";
const GOLD_LIGHT = "#e6c168";

function TealDeal({ d }) {
  const feats = services(d).slice(0, 4);
  return (
    <div className="pf-canvas pf-t9">
      <div className="pf-t9-logo">{d.logoText}</div>
      <div className="pf-t9-head">
        <h1>{d.headline}</h1>
        {d.tagline && <p>{d.tagline}</p>}
      </div>

      <div className="pf-t9-photo-a" style={{ backgroundImage: `url(${d.photo})` }} />
      <div className="pf-t9-photo-b" style={{ backgroundImage: `url(${d.photo2})` }} />
      {/* Gold seam between the two photo bands. */}
      <svg className="pf-t9-seam" viewBox="0 0 794 1123" preserveAspectRatio="none">
        <path d="M0,512 L794,468 L794,486 L0,530 Z" fill={GOLD_LIGHT} />
      </svg>

      <div className="pf-t9-offer">
        <div className="pf-t9-ribbon">{d.badgeText || "Book Direct"}</div>
        <strong>{d.price}</strong>
        <span>{d.priceNote}</span>
      </div>

      <div className="pf-t9-card">
        {feats.map((s, i) => (
          <div key={s} className="pf-t9-feat">
            <Icon name={ICON_CYCLE[i]} color={TEAL} size={24} width={1.7} />
            <span>{s}</span>
          </div>
        ))}
      </div>

      {/* Curved teal foot, drawn rather than clipped so it survives export. */}
      <svg className="pf-t9-curve" viewBox="0 0 794 1123" preserveAspectRatio="none">
        <path d="M0,1123 V879 C240,791 554,791 794,879 V1123 Z" fill={TEAL} />
        <path d="M0,879 C240,791 554,791 794,879" fill="none" stroke={GOLD_LIGHT} strokeWidth="3" />
      </svg>

      <div className="pf-t9-close">
        <h2>{d.hotelName}</h2>
        <p>{d.description}</p>
      </div>

      <div className="pf-t9-foot">
        <span>
          <Icon name="phone" color={TEAL} size={20} width={1.8} />
          {d.phone}
        </span>
        <em />
        <span>
          <Icon name="globe" color={TEAL} size={20} width={1.8} />
          {d.website}
        </span>
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
  {
    id: "grand-arc",
    name: "Grand Arc",
    blurb: "Navy and gold, arched hero over an icon feature row",
    Component: GrandArc,
  },
  {
    id: "estate-card",
    name: "Estate Card",
    blurb: "Swoosh-cut hero, dark price deck and circular photos",
    Component: EstateCard,
  },
  {
    id: "noir-gold",
    name: "Noir Gold",
    blurb: "Monogram masthead in near-black with a gold booking bar",
    Component: NoirGold,
  },
  {
    id: "teal-deal",
    name: "Teal Deal",
    blurb: "Offer poster — split photos, discount block, curved foot",
    Component: TealDeal,
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
