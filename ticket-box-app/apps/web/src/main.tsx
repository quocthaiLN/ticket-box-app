import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./routes/AppLayout";
import { AdminCatalogPage } from "./routes/admin/AdminCatalogPage";
import { AdminHomePage } from "./routes/admin/AdminHomePage";
import { AudienceHomePage } from "./routes/audience/AudienceHomePage";
import { ConcertDetailPage } from "./routes/audience/ConcertDetailPage";
import "./styles/globals.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <AudienceHomePage />
      },
      {
        path: "concerts/:concertId",
        element: <ConcertDetailPage />
      },
      {
        path: "admin",
        element: <AdminHomePage />
      },
      {
        path: "admin/catalog",
        element: <AdminCatalogPage />
      }
    ]
  }
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
