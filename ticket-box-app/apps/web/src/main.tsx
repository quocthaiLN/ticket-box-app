import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./routes/AppLayout";
import { AdminCatalogPage } from "./routes/admin/AdminCatalogPage";
import { AdminDeletionRequestsPage } from "./routes/admin/AdminDeletionRequestsPage";
import { AdminHomePage } from "./routes/admin/AdminHomePage";
import { AdminOrganizerRequestsPage } from "./routes/admin/AdminOrganizerRequestsPage";
import { AuthPage } from "./routes/auth/AuthPage";
import { AudienceHomePage } from "./routes/audience/AudienceHomePage";
import { ConcertDetailPage } from "./routes/audience/ConcertDetailPage";
import { CheckoutPage } from "./routes/audience/CheckoutPage";
import { EventsPage } from "./routes/audience/EventsPage";
import { MyTicketsPage } from "./routes/audience/MyTicketsPage";
import { SeatSelectionPage } from "./routes/audience/SeatSelectionPage";
import { CheckerPage } from "./routes/checker/CheckerPage";
import { PaymentResultPage } from "./routes/payment/PaymentResultPage";
import { OrganizerWorkspacePage } from "./routes/organizer/OrganizerWorkspacePage";
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
        path: "concerts/:concertId/seats",
        element: <SeatSelectionPage />
      },
      {
        path: "checkout",
        element: <CheckoutPage />
      },
      {
        path: "my-tickets",
        element: <MyTicketsPage />
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
        path: "admin/organizer-requests",
        element: <AdminOrganizerRequestsPage />
      },
      {
        path: "admin/deletion-requests",
        element: <AdminDeletionRequestsPage />
      },
      {
        path: "organizer",
        element: <OrganizerWorkspacePage view="dashboard" />
      },
      {
        path: "organizer/requests",
        element: <OrganizerWorkspacePage view="requests" />
      },
      {
        path: "organizer/requests/new",
        element: <OrganizerWorkspacePage view="requests" />
      },
      {
        path: "organizer/concerts",
        element: <OrganizerWorkspacePage view="concerts" />
      },
      {
        path: "checker",
        element: <CheckerPage />
      },
      {
        path: "payment/result",
        element: <PaymentResultPage />
      }
    ]
  }
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
