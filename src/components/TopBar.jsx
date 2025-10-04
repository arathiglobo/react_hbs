import React from 'react';
import { Navbar, Container, Nav, Dropdown, Image } from 'react-bootstrap';

export default function TopBar(){
  return (
    <Navbar bg="white" className="topbar shadow-sm" expand="lg" sticky="top">
      <Container fluid className="px-3">
        <Navbar.Brand href="#" className="d-flex align-items-center gap-2">
          <div className="logo-placeholder">GS</div>
          <span className="fw-semibold">Globosoft</span>
        </Navbar.Brand>
        <Nav className="ms-auto">
          <Dropdown align="end">
            <Dropdown.Toggle as={ProfileToggle} id="profile-dropdown" />
            <Dropdown.Menu className="shadow-sm">
              <Dropdown.Item href="#/change-password">Change Password</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item href="/">Logout</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Nav>
      </Container>
    </Navbar>
  );
}

const ProfileToggle = React.forwardRef(({ onClick }, ref) => (
  <a
    href="#profile"
    ref={ref}
    onClick={(e) => { e.preventDefault(); onClick(e); }}
    className="d-flex align-items-center gap-2 text-decoration-none profile-toggle"
  >
    <Image roundedCircle width={34} height={34} src={avatarUrl} alt="profile" />
    <span className="d-none d-sm-inline text-dark">Profile</span>
  </a>
));

// Placeholder avatar for the logged-in agent
const avatarUrl = 'https://i.pravatar.cc/100?img=12';


