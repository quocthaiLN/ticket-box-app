import express, { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { OrganizerController } from "./organizer.controller.js";

export const organizerRouter = Router();

const controller = new OrganizerController();
const organizerOnly = [requireAuth, requireRole("ORGANIZER")] as const;

organizerRouter.use("/organizer", ...organizerOnly);

organizerRouter.post(
  "/organizer/uploads/cover-image",
  express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/gif"], limit: "5mb" }),
  controller.uploadCoverImage,
);

organizerRouter.get("/organizer/venues", controller.listVenues);
organizerRouter.get("/organizer/requests", controller.listRequests);
organizerRouter.post("/organizer/press-kits/upload-url", controller.createPressKitUpload);
organizerRouter.post("/organizer/requests", controller.createRequest);
organizerRouter.get("/organizer/requests/:request_id", controller.getRequest);

organizerRouter.get("/organizer/concerts", controller.listConcerts);
organizerRouter.post("/organizer/concerts/:concert_id", controller.updateDraftConcert);
organizerRouter.post("/organizer/concerts/:concert_id/seat-zones", controller.createSeatZone);
organizerRouter.post("/organizer/concerts/:concert_id/ticket-types", controller.createTicketType);
organizerRouter.post("/organizer/concerts/:concert_id/deletion-requests", controller.createDeletionRequest);
organizerRouter.get("/organizer/concerts/:concert_id/analytics", controller.getAnalytics);
organizerRouter.get("/organizer/concerts/:concert_id/guests", controller.listGuests);

organizerRouter.get("/organizer/orders", controller.listOrders);
organizerRouter.get("/organizer/ticket-types/:ticket_type_id/inventory", controller.getTicketTypeInventory);
organizerRouter.get("/organizer/checker-accounts", controller.listCheckerAccounts);
