import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DebateGenerator from "./DebateGenerator.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DebateGenerator />
  </StrictMode>
);
