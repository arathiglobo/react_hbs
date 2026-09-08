import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Table, Modal, Form, Row, Col, Badge } from "react-bootstrap";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/TopBar";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaCheck,
  FaTimes,
  FaPlus,
  FaPrint,
  FaFileImage,
  FaFilePdf,
} from "react-icons/fa";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "../../styles/PromotionFlyer.css";
import {
  FLYER_TEMPLATES,
  EMPTY_FLYER,
  FlyerCanvas,
  getTemplate,
} from "./promotionFlyerTemplates";
import {
  listFlyers,
  createFlyer,
  updateFlyer,
  deleteFlyer,
} from "./promotionFlyerStore";

/**
 * Marketing → Promotion Flyer.
 *
 * Two-step create: pick one of the nine designs, then fill the promotion's
 * details. The form and a live preview sit side by side, so changing a field
 * or swapping the template redraws immediately — the data is held in one
 * object shared by all nine designs, which is why switching never loses input.
 *
 * Persistence goes through promotionFlyerStore (localStorage today) — see the
 * note at the top of that file before moving flyers server-side.
 *
 * A finished flyer leaves the page three ways — print, PNG and PDF — and all
 * three run off the SAME hidden full-size render, so they cannot disagree.
 */

/** A4 at 96dpi, matching FLYER_CANVAS in promotionFlyerTemplates.jsx. */
const CANVAS_W = 794;
const CANVAS_H = 1123;

/** 2x gives a 1588x2246 file: sharp when printed, still small enough to send. */
const EXPORT_SCALE = 2;

/** `The Royal Hotel` + `Summer Escape` -> `the-royal-hotel-summer-escape.png` */
const fileName = (flyer, ext) => {
  const slug = `${flyer.hotelName || ""}-${flyer.headline || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "promotion-flyer"}.${ext}`;
};

const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before the URL dies.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * Warm the browser cache for a flyer's photos.
 *
 * Both exports need the artwork decoded before the flyer is captured or handed
 * to a print window, or the operator gets empty boxes where the photos were.
 * This reads the URLs off the flyer rather than out of the DOM because the
 * templates paint photos as background-image (see the export note in
 * promotionFlyerTemplates.jsx), so there is no <img> left to wait on.
 */
const preloadPhotos = (flyer) =>
  Promise.all(
    [flyer.photo, flyer.photo2, flyer.photo3].filter(Boolean).map(
      (src) =>
        new Promise((resolve) => {
          const im = new Image();
          im.onload = resolve;
          im.onerror = resolve; // a broken URL must not hang the download
          im.src = src;
        }),
    ),
  );

export default function PromotionFlyer() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create / edit wizard
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // flyer being edited, or null
  const [step, setStep] = useState(1); // 1 = choose template, 2 = details
  const [form, setForm] = useState(EMPTY_FLYER);
  const [serviceDraft, setServiceDraft] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Read-only preview of a saved flyer
  const [previewing, setPreviewing] = useState(null);
  // Flyer currently being printed or downloaded: { flyer, mode } — see below
  const [job, setJob] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listFlyers());
    } catch {
      toast.error("Could not load promotions");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ── form helpers ──────────────────────────────────────────────────────── */

  const set = (field) => (e) => {
    const value = e && e.target ? e.target.value : e;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const addService = () => {
    const label = serviceDraft.trim();
    if (!label) return;
    setForm((f) =>
      f.services.includes(label) ? f : { ...f, services: [...f.services, label] },
    );
    setServiceDraft("");
  };

  const removeService = (label) =>
    setForm((f) => ({ ...f, services: f.services.filter((s) => s !== label) }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FLYER);
    setServiceDraft("");
    setErrors({});
    setStep(1);
    setShowModal(true);
  };

  const openEdit = (flyer) => {
    setEditing(flyer);
    // Merge over EMPTY_FLYER so a flyer saved before a field existed still
    // opens with every input populated rather than undefined.
    setForm({ ...EMPTY_FLYER, ...flyer });
    setServiceDraft("");
    setErrors({});
    setStep(2); // editing goes straight to the details; the design is changeable there
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditing(null);
    setErrors({});
  };

  const validate = () => {
    const next = {};
    if (!form.hotelName.trim()) next.hotelName = "Hotel name is required";
    if (!form.headline.trim()) next.headline = "Offer headline is required";
    if (!form.price.trim()) next.price = "Price is required";
    if (form.validFrom && form.validTo && form.validTo < form.validFrom) {
      next.validTo = "End date cannot be before the start date";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      toast.error("Please complete the highlighted fields");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateFlyer(editing.id, form);
        toast.success("Promotion updated");
      } else {
        await createFlyer(form);
        toast.success("Promotion created");
      }
      await load();
      setShowModal(false);
      setEditing(null);
    } catch (err) {
      toast.error(err.message || "Could not save the promotion");
    } finally {
      setSaving(false);
    }
  };

  const remove = (flyer) => {
    Swal.fire({
      title: `Delete "${flyer.hotelName}"?`,
      text: "This promotion will be removed permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it",
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        await deleteFlyer(flyer.id);
        toast.success("Promotion deleted");
        load();
      } catch {
        toast.error("Could not delete the promotion");
      }
    });
  };

  /* Print and download all render the flyer at full size ONCE, into a single
     hidden node driven by this state — not one hidden canvas per row, which
     would put a complete 794x1123 artboard (and its images) in the DOM for
     every promotion in the list. */
  const busy = !!job;
  const run = (flyer, mode) => {
    if (!flyer || busy) return; // one export at a time — they share the node
    setJob({ flyer, mode });
  };

  useEffect(() => {
    if (!job) return undefined;
    const root = document.getElementById("pf-print-root");
    if (!root) return undefined;

    let cancelled = false;

    const print = () => {
      const w = window.open("", "_blank", "width=900,height=1180");
      if (!w) {
        toast.error("Allow pop-ups to print this promotion");
        return;
      }
      const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
        .map((n) => n.outerHTML)
        .join("");
      // The flyer body is React-rendered so it is already escaped; the title is
      // raw user input, so it is escaped here before going into <title>.
      const title = String(job.flyer.hotelName || "Promotion").replace(/[<>&]/g, "");
      w.document.write(
        `<!doctype html><html><head><title>${title}</title>${styles}` +
          `<style>body{margin:0;background:#fff}@page{size:A4;margin:0}</style></head>` +
          `<body>${root.innerHTML}</body></html>`,
      );
      w.document.close();
      setTimeout(() => {
        w.focus();
        w.print();
      }, 500);
    };

    const download = async () => {
      const toastId = toast.loading(
        job.mode === "pdf" ? "Building the PDF..." : "Building the image...",
      );
      try {
        const canvas = await html2canvas(root, {
          scale: EXPORT_SCALE,
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: "#ffffff",
          // Operator-supplied photos can live on another host; without this a
          // CORS-enabled one is dropped instead of drawn.
          useCORS: true,
          logging: false,
        });

        if (job.mode === "pdf") {
          const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
          // JPEG, not PNG: the flyers are photographic, and a lossless page
          // image would make a 10MB+ PDF that is awkward to email.
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
          pdf.save(fileName(job.flyer, "pdf"));
        } else {
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
          if (!blob) throw new Error("The image could not be created");
          saveBlob(blob, fileName(job.flyer, "png"));
        }
        toast.success("Downloaded", { id: toastId });
      } catch (err) {
        toast.error(err.message || "Could not create the download", { id: toastId });
      }
    };

    // Wait for the artwork, or the flyer is captured with empty photo boxes.
    preloadPhotos(job.flyer).then(async () => {
      if (cancelled) return;
      if (job.mode === "print") print();
      else await download();
      if (!cancelled) setJob(null);
    });

    return () => {
      cancelled = true;
    };
  }, [job]);

  const activeTemplate = useMemo(() => getTemplate(form.templateId), [form.templateId]);

  /* ── render ────────────────────────────────────────────────────────────── */

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      <Topbar />
      <div className="d-flex flex-grow-1">
        <Sidebar />
        <main className="flex-grow-1 p-4">
          <Card className="shadow-sm rounded-xl">
            <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <span className="fw-semibold">Promotion Flyer</span>
                <div className="text-muted" style={{ fontSize: 12.5 }}>
                  Pick a design, fill in the offer, and the promotion is created.
                </div>
              </div>
              <Button className="btn-success d-flex align-items-center" onClick={openCreate}>
                <FaPlus className="me-2" /> Create Promotion
              </Button>
            </Card.Header>

            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table className="table-hover mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th className="border-0">S.N</th>
                      <th className="border-0">Flyer</th>
                      <th className="border-0">Hotel / Offer</th>
                      <th className="border-0">Template</th>
                      <th className="border-0">Price</th>
                      <th className="border-0">Validity</th>
                      <th className="border-0">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          <span className="spinner-border spinner-border-sm text-primary me-2" />
                          Loading promotions...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-5 text-muted">
                          No promotions yet — use <strong>Create Promotion</strong> to build one.
                        </td>
                      </tr>
                    ) : (
                      items.map((f, i) => (
                        <tr key={f.id}>
                          <td>{i + 1}</td>
                          <td>
                            <div className="pf-row-thumb">
                              <FlyerCanvas data={f} scale={0.06} />
                            </div>
                          </td>
                          <td>
                            <div className="fw-semibold">{f.hotelName}</div>
                            <div className="text-muted" style={{ fontSize: 12.5 }}>
                              {f.headline}
                            </div>
                          </td>
                          <td>
                            <Badge bg="light" text="dark" className="border">
                              {getTemplate(f.templateId).name}
                            </Badge>
                          </td>
                          <td className="fw-semibold">
                            {f.price}
                            <div className="text-muted fw-normal" style={{ fontSize: 12 }}>
                              {f.priceNote}
                            </div>
                          </td>
                          <td style={{ fontSize: 12.5 }}>
                            {f.validFrom || f.validTo ? (
                              <>
                                {f.validFrom || "—"} → {f.validTo || "—"}
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-3">
                              <FaEye
                                className="text-secondary"
                                style={{ cursor: "pointer", fontSize: 17 }}
                                title="Preview"
                                onClick={() => setPreviewing(f)}
                              />
                              <FaEdit
                                className="text-primary"
                                style={{ cursor: "pointer", fontSize: 17 }}
                                title="Edit"
                                onClick={() => openEdit(f)}
                              />
                              <FaFileImage
                                className="text-success"
                                style={{ cursor: busy ? "wait" : "pointer", fontSize: 16 }}
                                title="Download as image (PNG)"
                                onClick={() => run(f, "png")}
                              />
                              <FaFilePdf
                                className="text-danger"
                                style={{ cursor: busy ? "wait" : "pointer", fontSize: 16 }}
                                title="Download as PDF"
                                onClick={() => run(f, "pdf")}
                              />
                              <FaPrint
                                className="text-dark"
                                style={{ cursor: busy ? "wait" : "pointer", fontSize: 16 }}
                                title="Print"
                                onClick={() => run(f, "print")}
                              />
                              <FaTrash
                                className="text-danger"
                                style={{ cursor: "pointer", fontSize: 16 }}
                                title="Delete"
                                onClick={() => remove(f)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          {/* ── Create / edit ─────────────────────────────────────────────── */}
          <Modal
            show={showModal}
            onHide={closeModal}
            size="xl"
            centered
            backdrop="static"
            keyboard={false}
            scrollable
          >
            <Modal.Header closeButton={!saving} className="bg-primary text-white">
              <Modal.Title style={{ fontSize: 18 }}>
                {editing ? "Edit Promotion" : "Create Promotion"}
                <span className="ms-2 opacity-75" style={{ fontSize: 13, fontWeight: 400 }}>
                  {step === 1 ? "· Step 1 of 2 — choose a design" : "· Step 2 of 2 — promotion details"}
                </span>
              </Modal.Title>
            </Modal.Header>

            <Modal.Body>
              {step === 1 ? (
                <>
                  <p className="text-muted" style={{ fontSize: 13.5 }}>
                    They all use the same details, so you can change your mind later without
                    retyping anything.
                  </p>
                  <div className="pf-pick-grid">
                    {FLYER_TEMPLATES.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        className={`pf-pick${form.templateId === t.id ? " is-active" : ""}`}
                        onClick={() => setForm((f) => ({ ...f, templateId: t.id }))}
                      >
                        <div className="pf-pick-thumb">
                          <FlyerCanvas data={{ ...form, templateId: t.id }} scale={0.2} />
                        </div>
                        <div className="pf-pick-name">
                          {t.name}
                          {form.templateId === t.id && (
                            <FaCheck className="text-success ms-2" size={12} />
                          )}
                        </div>
                        <div className="pf-pick-blurb">{t.blurb}</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <Row className="g-4">
                  <Col lg={7}>
                    <Form>
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <span className="fw-semibold">
                          Design: <span className="text-primary">{activeTemplate.name}</span>
                        </span>
                        <Button variant="outline-secondary" size="sm" onClick={() => setStep(1)}>
                          Change design
                        </Button>
                      </div>

                      <Form.Group className="mb-3">
                        <Form.Label>Hotel name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          value={form.hotelName}
                          onChange={set("hotelName")}
                          isInvalid={!!errors.hotelName}
                          placeholder="The Royal Luxury Hotel"
                        />
                        <Form.Control.Feedback type="invalid">{errors.hotelName}</Form.Control.Feedback>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Offer headline <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          value={form.headline}
                          onChange={set("headline")}
                          isInvalid={!!errors.headline}
                          placeholder="Summer Escape Offer"
                        />
                        <Form.Control.Feedback type="invalid">{errors.headline}</Form.Control.Feedback>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={form.description}
                          onChange={set("description")}
                          placeholder="What the guest gets — rooms, meals, extras."
                        />
                      </Form.Group>

                      <Row>
                        <Col sm={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Price <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                              value={form.price}
                              onChange={set("price")}
                              isInvalid={!!errors.price}
                              placeholder="AED 299"
                            />
                            <Form.Control.Feedback type="invalid">{errors.price}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                        <Col sm={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Price note</Form.Label>
                            <Form.Control
                              value={form.priceNote}
                              onChange={set("priceNote")}
                              placeholder="per night"
                            />
                          </Form.Group>
                        </Col>
                      </Row>

                      <Row>
                        <Col sm={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Valid from</Form.Label>
                            <Form.Control type="date" value={form.validFrom} onChange={set("validFrom")} />
                          </Form.Group>
                        </Col>
                        <Col sm={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Valid to</Form.Label>
                            <Form.Control
                              type="date"
                              value={form.validTo}
                              min={form.validFrom || undefined}
                              onChange={set("validTo")}
                              isInvalid={!!errors.validTo}
                            />
                            <Form.Control.Feedback type="invalid">{errors.validTo}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>
                      </Row>

                      <Form.Group className="mb-3">
                        <Form.Label>Services / highlights</Form.Label>
                        <div className="d-flex gap-2 mb-2">
                          <Form.Control
                            value={serviceDraft}
                            onChange={(e) => setServiceDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addService();
                              }
                            }}
                            placeholder="Swimming Pool"
                          />
                          <Button variant="outline-primary" onClick={addService}>
                            Add
                          </Button>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {form.services.length === 0 && (
                            <span className="text-muted" style={{ fontSize: 12.5 }}>
                              None added yet.
                            </span>
                          )}
                          {form.services.map((s) => (
                            <span key={s} className="pf-service-chip">
                              {s}
                              <button type="button" onClick={() => removeService(s)} title="Remove">
                                <FaTimes size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </Form.Group>

                      <Row>
                        <Col sm={4}>
                          <Form.Group className="mb-3">
                            <Form.Label>Phone</Form.Label>
                            <Form.Control value={form.phone} onChange={set("phone")} />
                          </Form.Group>
                        </Col>
                        <Col sm={4}>
                          <Form.Group className="mb-3">
                            <Form.Label>Email</Form.Label>
                            <Form.Control value={form.email} onChange={set("email")} />
                          </Form.Group>
                        </Col>
                        <Col sm={4}>
                          <Form.Group className="mb-3">
                            <Form.Label>Website</Form.Label>
                            <Form.Control value={form.website} onChange={set("website")} />
                          </Form.Group>
                        </Col>
                      </Row>

                      <Form.Group className="mb-3">
                        <Form.Label>Logo text</Form.Label>
                        <Form.Control value={form.logoText} onChange={set("logoText")} />
                      </Form.Group>

                      <Row>
                        <Col sm={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Tagline</Form.Label>
                            <Form.Control
                              value={form.tagline}
                              onChange={set("tagline")}
                              placeholder="Comfort. Elegance. Warmth."
                            />
                          </Form.Group>
                        </Col>
                        <Col sm={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Badge text</Form.Label>
                            <Form.Control
                              value={form.badgeText}
                              onChange={set("badgeText")}
                              placeholder="Deluxe Room"
                            />
                          </Form.Group>
                        </Col>
                      </Row>

                      <Form.Group className="mb-3">
                        <Form.Label>Address</Form.Label>
                        <Form.Control value={form.address} onChange={set("address")} />
                        <Form.Text className="text-muted">
                          Tagline, badge and address are only drawn by the four poster designs —
                          the first five ignore them.
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-1">
                        <Form.Label>Images</Form.Label>
                        <Form.Control
                          className="mb-2"
                          value={form.photo}
                          onChange={set("photo")}
                          placeholder="Main photo URL"
                        />
                        <Row>
                          <Col sm={6}>
                            <Form.Control
                              className="mb-2"
                              value={form.photo2}
                              onChange={set("photo2")}
                              placeholder="Second photo URL"
                            />
                          </Col>
                          <Col sm={6}>
                            <Form.Control
                              className="mb-2"
                              value={form.photo3}
                              onChange={set("photo3")}
                              placeholder="Third photo URL"
                            />
                          </Col>
                        </Row>
                        <Form.Text className="text-muted">
                          Any image URL. The second and third are only used by the designs that
                          show more than one photo.
                        </Form.Text>
                      </Form.Group>
                    </Form>
                  </Col>

                  <Col lg={5}>
                    <div className="pf-preview-pane">
                      <FlyerCanvas data={form} scale={0.42} />
                    </div>
                  </Col>
                </Row>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="outline-secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              {step === 1 ? (
                <Button className="btn-success" onClick={() => setStep(2)}>
                  Continue with {activeTemplate.name}
                </Button>
              ) : (
                <Button className="btn-success d-flex align-items-center" onClick={submit} disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FaCheck className="me-2" />
                      {editing ? "Update Promotion" : "Create Promotion"}
                    </>
                  )}
                </Button>
              )}
            </Modal.Footer>
          </Modal>

          {/* ── Preview ───────────────────────────────────────────────────── */}
          <Modal show={!!previewing} onHide={() => setPreviewing(null)} size="lg" centered scrollable>
            <Modal.Header closeButton>
              <Modal.Title style={{ fontSize: 17 }}>{previewing?.hotelName}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="d-flex justify-content-center bg-body-secondary">
              {previewing && <FlyerCanvas data={previewing} scale={0.62} />}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={() => setPreviewing(null)}>
                Close
              </Button>
              <Button
                variant="outline-dark"
                disabled={busy}
                onClick={() => run(previewing, "print")}
              >
                <FaPrint className="me-2" /> Print
              </Button>
              <Button
                variant="outline-danger"
                disabled={busy}
                onClick={() => run(previewing, "pdf")}
              >
                <FaFilePdf className="me-2" /> Download PDF
              </Button>
              <Button className="btn-success" disabled={busy} onClick={() => run(previewing, "png")}>
                <FaFileImage className="me-2" /> Download Image
              </Button>
            </Modal.Footer>
          </Modal>

          {/* The one full-size render behind print and both downloads, mounted
              only while an export is running. It sits off-screen rather than
              display:none because html2canvas can only rasterise a node the
              browser has actually laid out. */}
          <div
            id="pf-print-root"
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 0,
              left: -20000,
              width: CANVAS_W,
              height: CANVAS_H,
              pointerEvents: "none",
            }}
          >
            {job && <FlyerCanvas data={job.flyer} scale={1} />}
          </div>
        </main>
      </div>
    </div>
  );
}
