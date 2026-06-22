import React, { useState } from "react";
import { Modal, Carousel } from "react-bootstrap";

const RestaurantImagesModal = ({ show, onHide, restaurant }) => {
  const [index, setIndex] = useState(0);
  const images = restaurant?.images || [];

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{restaurant?.restaurantName} - Photos</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0 bg-dark">
        {images.length === 0 ? (
          <div className="p-5 text-center text-white-50">No images available.</div>
        ) : (
          <Carousel
            activeIndex={index}
            onSelect={setIndex}
            interval={null}
            variant="dark"
          >
            {images.map((src, i) => (
              <Carousel.Item key={i}>
                <div
                  style={{
                    height: 480,
                    background: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={src}
                    alt={`slide-${i}`}
                    style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                  />
                </div>
              </Carousel.Item>
            ))}
          </Carousel>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default RestaurantImagesModal;
