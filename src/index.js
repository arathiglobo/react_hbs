import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/custom.scss'; // compiles full Bootstrap from SCSS with the brand red $primary
import './styles/modernTheme.css'; // global modern-premium polish (layout/spacing/shadows/motion only)
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // Includes Popper.js for Tabs
import App from './App';
const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <BrowserRouter>
   <App />
   </BrowserRouter>
);
