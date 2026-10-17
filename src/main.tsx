import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { startWebsiteAnalytics } from "./analytics";
import "./styles/site.css";
import "./styles/product-screens.css";

const root = document.getElementById("root");
if (!root)
  throw new Error("React application root is missing from the document.");

const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hydrate when the served document was prerendered for this exact pathname
// (marked by the prerender script) so the server markup stays painted and LCP
// is not delayed by a client re-render. Unknown edge-fallback routes still
// render from scratch because their served markup does not match the path.
const prerenderedPath = document
  .querySelector('meta[name="impact-gate-prerendered"]')
  ?.getAttribute("content");
const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
startWebsiteAnalytics();
if (prerenderedPath === currentPath) {
  hydrateRoot(root, app);
} else {
  createRoot(root).render(app);
}
