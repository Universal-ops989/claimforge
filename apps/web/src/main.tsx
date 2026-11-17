import "@claimforge/ui/styles.css";

import { ThemeProvider } from "@claimforge/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { routes } from "./routes";

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html has no #root element");
}

const router = createBrowserRouter(routes);

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
