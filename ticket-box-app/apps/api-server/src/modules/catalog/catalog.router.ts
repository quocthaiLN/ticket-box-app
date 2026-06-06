import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { CatalogController } from "./catalog.controller.js";

export const catalogRouter = Router();

const controller = new CatalogController();
const organizerOnly = [requireAuth, requireRole("ORGANIZER", "ADMIN")] as const;

catalogRouter.get("/concerts", controller.listPublishedConcerts);
catalogRouter.get("/concerts/:concert_id", controller.getPublishedConcert);
catalogRouter.get("/concerts/:concert_id/metadata", controller.getMetadata);
catalogRouter.get("/concerts/:concert_id/seat-map", controller.getSeatMap);
catalogRouter.get("/concerts/:concert_id/ticket-types", controller.listTicketTypes);
catalogRouter.get("/concerts/:concert_id/inventory", controller.getInventory);

catalogRouter.get("/admin/venues", ...organizerOnly, controller.listVenues);
catalogRouter.post("/admin/venues", ...organizerOnly, controller.createVenue);
catalogRouter.patch("/admin/venues/:venue_id", ...organizerOnly, controller.updateVenue);

catalogRouter.get("/admin/concerts", ...organizerOnly, controller.listAdminConcerts);
catalogRouter.post("/admin/concerts", ...organizerOnly, controller.createConcert);
catalogRouter.patch("/admin/concerts/:concert_id", ...organizerOnly, controller.updateConcert);
catalogRouter.post("/admin/concerts/:concert_id/publish", ...organizerOnly, controller.publishConcert);
catalogRouter.post("/admin/concerts/:concert_id/cancel", ...organizerOnly, controller.cancelConcert);

catalogRouter.post("/admin/concerts/:concert_id/seat-zones", ...organizerOnly, controller.createSeatZone);
catalogRouter.patch("/admin/seat-zones/:seat_zone_id", ...organizerOnly, controller.updateSeatZone);

catalogRouter.post("/admin/concerts/:concert_id/ticket-types", ...organizerOnly, controller.createTicketType);
catalogRouter.patch("/admin/ticket-types/:ticket_type_id", ...organizerOnly, controller.updateTicketType);
