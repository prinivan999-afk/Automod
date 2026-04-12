import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => {
  try {
    const saved = localStorage.getItem("crm_profile");
    if (!saved) return null;
    const profile = JSON.parse(saved);
    return profile?.apiToken ?? null;
  } catch {
    return null;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
