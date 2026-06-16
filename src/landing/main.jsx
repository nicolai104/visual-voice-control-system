import React from "react";
import { createRoot } from "react-dom/client";
import "swiper/css";
import "./styles.css";
import { LandingApp } from "./LandingApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LandingApp />
  </React.StrictMode>
);
