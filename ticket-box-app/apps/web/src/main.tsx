import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./routes/AppLayout";
import { AdminCatalogPage } from "./routes/admin/AdminCatalogPage";
import { AdminHomePage } from "./routes/admin/AdminHomePage";
import { AuthPage } from "./routes/auth/AuthPage";
import { AudienceHomePage } from "./routes/audience/AudienceHomePage";
import { ConcertDetailPage } from "./routes/audience/ConcertDetailPage";
import { EventsPage } from "./routes/audience/EventsPage";
import { CheckerPage } from "./routes/checker/CheckerPage";
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
        path: "events",
        element: <EventsPage />
      },
      {
        path: "concerts/:concertId",
        element: <ConcertDetailPage />
      },
      {
        path: "login",
        element: <AuthPage mode="login" />
      },
      {
        path: "register",
        element: <AuthPage mode="register" />
      },
      {
        path: "admin",
        element: <AdminHomePage />
      },
      {
        path: "admin/catalog",
        element: <AdminCatalogPage />
      },
      {
        path: "checker",
        element: <CheckerPage />
      }
    ]
  }
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
