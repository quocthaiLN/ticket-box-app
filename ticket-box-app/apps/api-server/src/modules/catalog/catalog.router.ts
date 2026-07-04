import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { CatalogController } from "./catalog.controller.js";

export const catalogRouter = Router();

const controller = new CatalogController();
const adminOnly = [requireAuth, requireRole("ADMIN")] as const;

catalogRouter.get("/concerts", controller.listPublishedConcerts);
catalogRouter.get("/concerts/:concert_id", controller.getPublishedConcert);
catalogRouter.get("/concerts/:concert_id/metadata", controller.getMetadata);
catalogRouter.get("/concerts/:concert_id/seat-map", controller.getSeatMap);
catalogRouter.get("/concerts/:concert_id/ticket-types", controller.listTicketTypes);
catalogRouter.get("/concerts/:concert_id/inventory", controller.getInventory);

catalogRouter.get("/admin/concerts", ...adminOnly, controller.listAdminConcerts);
catalogRouter.patch("/admin/concerts/:concert_id", ...adminOnly, controller.updateConcert);
catalogRouter.post("/admin/concerts/:concert_id/publish", ...adminOnly, controller.publishConcert);
catalogRouter.post("/admin/concerts/:concert_id/cancel", ...adminOnly, controller.cancelConcert);
