import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { RoutesApp } from "./routes";
import "./styles.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 8_000 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
          <RoutesApp />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
