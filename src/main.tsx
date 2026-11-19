import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import NotConnected from "./components/layout/NotConnected";
import { API_CONFIGURED } from "./services/api";
import "./index.css";

// HashRouter keeps routes working on GitHub Pages (no server-side rewrites).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {API_CONFIGURED ? (
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    ) : (
      <NotConnected />
    )}
  </StrictMode>
);
