/**
 * PDF export for the login-page footer panels (About us, Privacy Policy,
 * Systems Policy, Terms & Conditions).
 *
 * Callers describe the document as a flat list of typed blocks — built from
 * the same data the panels render — and this module lays it out on A4 with
 * the Desert Beds logo, a title block, running headers on later pages and
 * "Page x of y" footers. jsPDF is imported on demand so it stays out of the
 * login bundle until someone actually asks for a PDF.
 *
 * Block types:
 *   { type: "p", text }                    paragraph
 *   { type: "lede", text }                 emphasised one-liner (orange)
 *   { type: "h3", text, no? }              section heading, optional number
 *   { type: "h4", text }                   sub-heading
 *   { type: "bullets", items, columns? }   bulleted list, 1 or 2 columns
 *   { type: "clauses", clauses }           numbered clauses; `sub` nests
 *   { type: "email", email, label? }       "Email: x" with a mailto link
 *   { type: "signoff", text }              closing line under a rule
 */

// Mirrors the --lg-* tokens in LoginModern.css (jsPDF needs RGB triples).
const COLORS = {
  orange: [247, 94, 0],
  orangeDark: [214, 81, 0],
  navy: [27, 42, 74],
  body: [90, 100, 120],
  ink: [59, 63, 71],
  muted: [138, 147, 163],
  line: [230, 232, 238],
};

// A4 in millimetres. `top` is where body text starts on pages 2+ (below the
// running header); `bottom` keeps clear of the footer.
const PAGE = { width: 210, height: 297, marginX: 20, top: 26, bottom: 24 };
const CONTENT_LEFT = PAGE.marginX;
const CONTENT_RIGHT = PAGE.width - PAGE.marginX;

const LOGO_SRC = `${process.env.PUBLIC_URL}/images/desert-white.PNG`;
const FOOTER_TEXT =
  "Desert Beds LLC  |  Sharjah Media City, United Arab Emirates  |  www.desertbeds.com";

// Number-column widths for clause levels 1.1 / 1.1.1 / 1.1.1.1.
const CLAUSE_NO_COL = [11, 14, 18];

// Line height in mm for a font size in pt.
const lineHeight = (pt, factor = 1.45) => pt * 0.3528 * factor;

// The built-in PDF fonts only cover basic Latin, so typographic quotes,
// dashes and emoji are folded to plain equivalents before drawing.
const clean = (text) =>
  String(text)
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "|")
    .replace(/[   ]/g, " ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const loadLogo = () =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // fall back to a text wordmark
    img.src = LOGO_SRC;
  });

// Small stateful cursor over the document: tracks the current y position and
// starts a new page whenever the next piece would run into the footer.
function createWriter(doc) {
  const w = { y: 0 };

  // jsPDF's width measurement runs slightly short, so wrap a hair early to
  // keep long lines inside the right margin.
  const wrap = (text, width) => doc.splitTextToSize(clean(text), width - 1);

  w.font = (size, style = "normal", color = COLORS.ink) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  // Returns true when a page break happened.
  w.ensure = (height) => {
    if (w.y + height <= PAGE.height - PAGE.bottom) return false;
    doc.addPage();
    w.y = PAGE.top;
    return true;
  };

  w.rule = (color, width, x1 = CONTENT_LEFT, x2 = CONTENT_RIGHT) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, w.y, x2, w.y);
  };

  // Wrapped text block; `w.y` is the top of the first line box.
  w.text = (text, opts = {}) => {
    const {
      x = CONTENT_LEFT,
      width = CONTENT_RIGHT - x,
      size = 10,
      style = "normal",
      color = COLORS.ink,
      factor = 1.45,
      after = 0,
    } = opts;
    w.font(size, style, color);
    const lh = lineHeight(size, factor);
    const lines = wrap(text, width);
    // Keep at least two lines together so a paragraph never starts with a
    // lone line at the foot of a page.
    w.ensure(lh * Math.min(lines.length, 2));
    lines.forEach((line) => {
      w.ensure(lh);
      doc.text(line, x, w.y + lh * 0.72);
      w.y += lh;
    });
    w.y += after;
  };

  w.bullet = (text, x, width) => {
    const lh = lineHeight(10);
    w.font(10);
    const lines = wrap(text, width - 5);
    w.ensure(lh * Math.min(lines.length, 2));
    doc.setFillColor(...COLORS.orange);
    doc.circle(x + 1.3, w.y + lh * 0.5, 0.7, "F");
    w.text(text, { x: x + 5, width: width - 5 });
    w.y += 1.2;
  };

  w.bullets = (items, columns = 1) => {
    if (columns === 1) {
      items.forEach((item) => w.bullet(item, CONTENT_LEFT, CONTENT_RIGHT - CONTENT_LEFT));
      w.y += 2;
      return;
    }
    // Two columns, filled top-to-bottom like the CSS `columns` on screen.
    const gap = 8;
    const colW = (CONTENT_RIGHT - CONTENT_LEFT - gap) / 2;
    const half = Math.ceil(items.length / 2);
    const left = items.slice(0, half);
    const right = items.slice(half);
    const lh = lineHeight(10);
    w.font(10);
    for (let i = 0; i < half; i += 1) {
      const rows = [left[i], right[i]].filter(Boolean);
      const tallest = Math.max(
        ...rows.map((t) => wrap(t, colW - 5).length),
      );
      w.ensure(tallest * lh);
      const rowTop = w.y;
      let rowBottom = rowTop;
      [left[i], right[i]].forEach((item, col) => {
        if (!item) return;
        w.y = rowTop;
        w.bullet(item, CONTENT_LEFT + col * (colW + gap), colW);
        rowBottom = Math.max(rowBottom, w.y);
      });
      w.y = rowBottom;
    }
    w.y += 2;
  };

  w.clauses = (clauses, x = CONTENT_LEFT, depth = 0) => {
    const lh = lineHeight(10);
    clauses.forEach((clause) => {
      const textX = x + CLAUSE_NO_COL[Math.min(depth, CLAUSE_NO_COL.length - 1)];
      const width = CONTENT_RIGHT - textX;
      w.font(10);
      const lines = wrap(clause.text, width);
      // Number and first lines must land on the same page.
      w.ensure(lh * Math.min(lines.length, 2));
      w.font(10, "bold", depth === 0 ? COLORS.navy : COLORS.body);
      doc.text(clause.no, x, w.y + lh * 0.72);
      w.text(clause.text, { x: textX, width, after: 1.8 });
      if (clause.sub) w.clauses(clause.sub, textX, depth + 1);
    });
  };

  return w;
}

function drawTitleBlock(doc, w, logo, { eyebrow, title, subtitle }) {
  // Logo + portal tag on the first page only; later pages get the slimmer
  // running header drawn in the final pass.
  const logoW = 48;
  if (logo) {
    const logoH = logoW * (logo.naturalHeight / logo.naturalWidth);
    doc.addImage(logo, "PNG", CONTENT_LEFT, 15, logoW, logoH);
  } else {
    w.font(20, "bold", COLORS.orange);
    doc.text("desert beds", CONTENT_LEFT, 22);
  }
  w.font(8.5, "bold", COLORS.navy);
  doc.text("B2B Portal & DMC", CONTENT_RIGHT, 18.5, { align: "right" });
  w.font(8.5, "normal", COLORS.muted);
  doc.text("www.desertbeds.com", CONTENT_RIGHT, 23, { align: "right" });

  w.y = 31;
  w.rule(COLORS.orange, 0.8);
  w.y += 10;

  if (eyebrow) {
    w.font(8.5, "bold", COLORS.orange);
    doc.text(clean(eyebrow).toUpperCase(), CONTENT_LEFT, w.y, { charSpace: 0.5 });
    w.y += 3;
  }
  w.text(title, { size: 22, style: "bold", color: COLORS.navy, factor: 1.2, after: 1.5 });
  if (subtitle) w.text(subtitle, { size: 10.5, color: COLORS.body });

  w.y += 4;
  w.rule(COLORS.line, 0.3);
  w.y += 7;
}

function drawBlocks(doc, w, blocks) {
  blocks.forEach((block, i) => {
    switch (block.type) {
      case "p":
        w.text(block.text, { after: 3 });
        break;

      case "lede":
        w.text(block.text, { size: 10.5, style: "bold", color: COLORS.orangeDark, after: 2 });
        break;

      case "h3": {
        // Heading plus room for its first lines, so it never sits orphaned at
        // the foot of a page. The divider is skipped at the top of a page.
        const freshPage = w.ensure(22);
        if (i > 0 && !freshPage) {
          w.y += 3;
          w.rule(COLORS.line, 0.3);
          w.y += 6;
        }
        const size = 13;
        let x = CONTENT_LEFT;
        if (block.no) {
          const label = `${block.no}.`;
          w.font(size, "bold", COLORS.orange);
          doc.text(label, x, w.y + lineHeight(size, 1.3) * 0.72);
          x += doc.getTextWidth(label) + 2.5;
        }
        w.text(block.text, { x, size, style: "bold", color: COLORS.navy, factor: 1.3, after: 3 });
        break;
      }

      case "h4":
        w.ensure(14);
        w.y += 1.5;
        w.text(block.text, { size: 10.5, style: "bold", color: COLORS.navy, after: 1 });
        break;

      case "bullets":
        w.bullets(block.items, block.columns || 1);
        break;

      case "clauses":
        w.clauses(block.clauses);
        w.y += 1;
        break;

      case "email": {
        const lh = lineHeight(10);
        w.ensure(lh);
        const label = `${block.label || "Email"}: `;
        const base = w.y + lh * 0.72;
        w.font(10);
        doc.text(label, CONTENT_LEFT, base);
        const linkX = CONTENT_LEFT + doc.getTextWidth(label);
        w.font(10, "bold", COLORS.orangeDark);
        doc.textWithLink(block.email, linkX, base, { url: `mailto:${block.email}` });
        w.y += lh + 3;
        break;
      }

      case "signoff":
        w.ensure(16);
        w.y += 4;
        w.rule(COLORS.line, 0.3);
        w.y += 6;
        w.text(block.text, { style: "bold", color: COLORS.navy });
        break;

      default:
        break;
    }
  });
}

// Running header (pages 2+) and footer (every page). Done last so the total
// page count is known.
function drawPageChrome(doc, w, logo, title) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);

    if (p > 1) {
      if (logo) {
        const logoW = 26;
        const logoH = logoW * (logo.naturalHeight / logo.naturalWidth);
        doc.addImage(logo, "PNG", CONTENT_LEFT, 10, logoW, logoH);
      } else {
        w.font(11, "bold", COLORS.orange);
        doc.text("desert beds", CONTENT_LEFT, 14);
      }
      w.font(8.5, "normal", COLORS.muted);
      doc.text(clean(title), CONTENT_RIGHT, 14, { align: "right" });
      w.y = 18;
      w.rule(COLORS.line, 0.3);
    }

    w.y = PAGE.height - 16;
    w.rule(COLORS.line, 0.3);
    w.font(8, "normal", COLORS.muted);
    doc.text(FOOTER_TEXT, CONTENT_LEFT, PAGE.height - 11);
    doc.text(`Page ${p} of ${total}`, CONTENT_RIGHT, PAGE.height - 11, { align: "right" });
  }
}

/**
 * Builds the PDF and triggers the browser download.
 * @param {{ fileName: string, eyebrow?: string, title: string,
 *           subtitle?: string, blocks: Array<object> }} spec
 */
export async function downloadLoginPanelPdf({ fileName, eyebrow, title, subtitle, blocks }) {
  const [mod, logo] = await Promise.all([import("jspdf"), loadLogo()]);
  const JsPDF = mod.jsPDF || mod.default;
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({
    title: `${clean(title)} - Desert Beds LLC`,
    subject: clean(title),
    author: "Desert Beds LLC",
    creator: "Desert Beds B2B Portal",
  });

  const w = createWriter(doc);
  drawTitleBlock(doc, w, logo, { eyebrow, title, subtitle });
  drawBlocks(doc, w, blocks);
  drawPageChrome(doc, w, logo, title);

  doc.save(fileName);
}
