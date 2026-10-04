import React from "react";
import { createRoot } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
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

startWebsiteAnalytics();

const requestedPath = window.location.pathname.replace(/\/+$/, "") || "/";
let renderedPath = "";
try {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) renderedPath = new URL(canonical.href).pathname.replace(/\/+$/, "") || "/";
} catch { /* Render a fresh page when fallback HTML has no valid canonical route. */ }

// A fallback document belongs to a different route and cannot be hydrated as-is.
if (root.hasChildNodes() && renderedPath === requestedPath) {
  hydrateRoot(root, app);
} else {
  createRoot(root).render(app);
}
