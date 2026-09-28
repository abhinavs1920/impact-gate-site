import React from "react";
import { hydrateRoot } from "react-dom/client";
import App from "./App";
import "./styles/site.css";

const root = document.getElementById("root");
if (!root)
  throw new Error("React application root is missing from the document.");

hydrateRoot(
  root,
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
