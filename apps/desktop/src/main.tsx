import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import { AppThemeProvider } from "./components/theme-provider";
import { displayName } from "./lib/display-name";

import "./index.css";

// Window title carries the env postfix ("Tymar Dev" in dev) — the Rust side
// sets the native title too; this keeps the document in sync.
document.title = displayName;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </React.StrictMode>,
);
