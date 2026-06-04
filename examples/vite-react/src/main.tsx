import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FlexProvider } from "@flex/react";
import { App } from "./App.js";

const url = import.meta.env.VITE_FLEX_URL ?? "http://localhost:3210";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FlexProvider url={url}>
      <App />
    </FlexProvider>
  </StrictMode>
);
