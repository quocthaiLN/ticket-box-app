import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./routes/AppLayout";
import { AdminAccountsPage } from "./routes/admin/AdminAccountsPage";
import { AdminAuditLogPage } from "./routes/admin/AdminAuditLogPage";
import { AdminDeletionRequestsPage } from "./routes/admin/AdminDeletionRequestsPage";
import { AdminConcertDetailPage } from "./routes/admin/AdminConcertDetailPage";
import { AdminHomePage } from "./routes/admin/AdminHomePage";
import { AdminOrganizerRequestReviewPage, AdminOrganizerRequestsPage } from "./routes/admin/AdminOrganizerRequestsPage";
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
import { ConcertPreviewPage } from "./routes/preview/ConcertPreviewPage";
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
        path: "admin/organizer-requests",
        element: <AdminOrganizerRequestsPage />
      },
      {
        path: "admin/organizer-requests/:requestId",
        element: <AdminOrganizerRequestReviewPage />
      },
      {
        path: "admin/deletion-requests",
        element: <AdminDeletionRequestsPage />
      },
      {
        path: "admin/accounts",
        element: <AdminAccountsPage />
      },
      {
        path: "admin/audit-logs",
        element: <AdminAuditLogPage />
      },
      {
        path: "admin/concerts/:concertId",
        element: <AdminConcertDetailPage />
      },
      {
        path: "admin/concerts/:concertId/preview",
        element: <ConcertPreviewPage role="admin" />
      },
      {
        path: "organizer/concerts/:concertId/preview",
        element: <ConcertPreviewPage role="organizer" />
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
