
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/custom.scss';
// import 'bootstrap/dist/css/bootstrap.min.css';
// /// import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // Includes Popper.js for Tabs

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <BrowserRouter>
   <App />
   </BrowserRouter>
);
