import React, { useMemo, useState } from "react";
import { Modal, Table, Form, Badge, Button, InputGroup } from "react-bootstrap";
import { FaSearch, FaPlus, FaMinus } from "react-icons/fa";

/**
 * Reusable Menu modal.
 * Mode "view"  : read-only display
 * Mode "select": +/- quantity controls; emits onConfirm(selectedItems[])
 */
const RestaurantMenuModal = ({
  show,
  onHide,
  restaurant,
  mode = "view",
  initialSelected = [],
  onConfirm,
}) => {
  const [qtyMap, setQtyMap] = useState(() => {
    const m = {};
    initialSelected.forEach((it) => {
      m[it.menuId || it.id] = it.qty;
    });
    return m;
  });
  const [filter, setFilter] = useState("");

  const menus = restaurant?.menuList || [];
  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return menus.filter(
      (m) =>
        !q ||
        m.menuName?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
    );
  }, [menus, filter]);

  const setQty = (id, val) => {
    setQtyMap((prev) => {
      const next = { ...prev };
      const v = Math.max(0, Number(val) || 0);
      if (v === 0) delete next[id];
      else next[id] = v;
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = menus
      .filter((m) => qtyMap[m.id || m.menuId])
      .map((m) => ({
        menuId: m.id || m.menuId,
        menuName: m.menuName,
        price: Number(m.price) || 0,
        qty: qtyMap[m.id || m.menuId],
        total: (Number(m.price) || 0) * qtyMap[m.id || m.menuId],
      }));
    onConfirm?.(selected);
    onHide();
  };

  const totalQty = Object.values(qtyMap).reduce((a, b) => a + b, 0);
  const totalAmount = menus.reduce((acc, m) => {
    const id = m.id || m.menuId;
    return acc + (qtyMap[id] || 0) * (Number(m.price) || 0);
  }, 0);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          Menu - {restaurant?.restaurantName}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <InputGroup className="mb-3">
          <InputGroup.Text>
            <FaSearch />
          </InputGroup.Text>
          <Form.Control
            placeholder="Search menu..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </InputGroup>

        {filtered.length === 0 ? (
          <div className="text-center text-muted py-4">No menu items.</div>
        ) : (
          <Table responsive hover bordered className="align-middle">
            <thead className="table-light">
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Price</th>
                <th>Type</th>
                {mode === "select" && <th style={{ width: 150 }}>Qty</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const id = m.id || m.menuId;
                return (
                  <tr key={id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {m.image && (
                          <img
                            src={m.image}
                            alt={m.menuName}
                            style={{
                              width: 42,
                              height: 42,
                              objectFit: "cover",
                              borderRadius: 6,
                            }}
                          />
                        )}
                        <div>
                          <div className="fw-semibold">{m.menuName}</div>
                          {m.description && (
                            <small className="text-muted">{m.description}</small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{m.category}</td>
                    <td>₹ {Number(m.price).toFixed(2)}</td>
                    <td>
                      <Badge bg={m.isVeg ? "success" : "danger"}>
                        {m.isVeg ? "Veg" : "Non-Veg"}
                      </Badge>
                    </td>
                    {mode === "select" && (
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setQty(id, (qtyMap[id] || 0) - 1)}
                          >
                            <FaMinus />
                          </Button>
                          <Form.Control
                            size="sm"
                            type="number"
                            min={0}
                            style={{ width: 60, textAlign: "center" }}
                            value={qtyMap[id] || 0}
                            onChange={(e) => setQty(id, e.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="outline-success"
                            onClick={() => setQty(id, (qtyMap[id] || 0) + 1)}
                          >
                            <FaPlus />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      {mode === "select" && (
        <Modal.Footer className="justify-content-between">
          <div>
            <strong>{totalQty}</strong> items · Total: <strong>₹ {totalAmount.toFixed(2)}</strong>
          </div>
          <div>
            <Button variant="outline-secondary" className="me-2" onClick={onHide}>
              Cancel
            </Button>
            <Button variant="warning" onClick={handleConfirm}>
              Add to Booking
            </Button>
          </div>
        </Modal.Footer>
      )}
    </Modal>
  );
};

export default RestaurantMenuModal;
