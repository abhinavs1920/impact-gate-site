import React from "react";
import { createRoot } from "react-dom/client";
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

// Public routes share a fallback document at the edge. Render from the current
// pathname instead of hydrating route-specific prerendered markup, which can
// differ after theme initialization and causes React hydration warnings.
createRoot(root).render(app);
