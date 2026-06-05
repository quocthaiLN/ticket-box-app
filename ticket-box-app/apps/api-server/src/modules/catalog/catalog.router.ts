import { Router } from "express";
import { requireRole } from "../../shared/guards/role.guard.js";
import { ok, collection } from "../../shared/http/response.js";
import { requireAuth } from "../../shared/middleware/auth.middleware.js";
import { parseAdminConcertsQuery, parseCatalogListQuery } from "./catalog.schema.js";
import { CatalogService } from "./catalog.service.js";

export const catalogRouter = Router();

const service = new CatalogService();

catalogRouter.get("/concerts", async (req, res, next) => {
  try {
    const query = parseCatalogListQuery(req.query);
    const concerts = await service.listPublishedConcerts(query);
    res.json(
      collection(concerts, req.requestId, {
        next_cursor: null,
        has_more: false,
        limit: query.limit
      })
    );
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/concerts/:concert_id", async (req, res, next) => {
  try {
    res.json(ok(await service.getPublishedConcert(req.params.concert_id), req.requestId));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/concerts/:concert_id/metadata", async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600");
    res.json(ok(await service.getMetadata(req.params.concert_id), req.requestId));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/concerts/:concert_id/seat-map", async (req, res, next) => {
  try {
    res.json(ok(await service.getSeatMap(req.params.concert_id), req.requestId));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/concerts/:concert_id/ticket-types", async (req, res, next) => {
  try {
    const includeClosed = req.query.include_closed === "true";
    res.json(ok(await service.listTicketTypes(req.params.concert_id, includeClosed), req.requestId));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/concerts/:concert_id/inventory", async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "max-age=5");
    res.json(ok(await service.getInventory(req.params.concert_id), req.requestId, { consistency: "EVENTUAL" }));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/admin/venues", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res, next) => {
  try {
    const query = parseCatalogListQuery(req.query);
    const venues = await service.listVenues(query);
    res.json(
      collection(venues, req.requestId, {
        next_cursor: null,
        has_more: false,
        limit: query.limit
      })
    );
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/admin/concerts", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res, next) => {
  try {
    const query = parseAdminConcertsQuery(req.query);
    const concerts = await service.listAdminConcerts(query);
    res.json(
      collection(concerts, req.requestId, {
        next_cursor: null,
        has_more: false,
        limit: query.limit
      })
    );
  } catch (err) {
    next(err);
  }
});

catalogRouter.post("/admin/venues", requireAuth, requireRole("ORGANIZER", "ADMIN"), (_req, _res, next) => {
  next(service.notImplemented("Create venue"));
});

catalogRouter.patch("/admin/venues/:venue_id", requireAuth, requireRole("ORGANIZER", "ADMIN"), (_req, _res, next) => {
  next(service.notImplemented("Update venue"));
});

catalogRouter.post("/admin/concerts", requireAuth, requireRole("ORGANIZER", "ADMIN"), (_req, _res, next) => {
  next(service.notImplemented("Create concert"));
});

catalogRouter.patch(
  "/admin/concerts/:concert_id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (_req, _res, next) => {
    next(service.notImplemented("Update concert"));
  }
);

catalogRouter.post(
  "/admin/concerts/:concert_id/publish",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (_req, _res, next) => {
    next(service.notImplemented("Publish concert"));
  }
);

catalogRouter.post(
  "/admin/concerts/:concert_id/cancel",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (_req, _res, next) => {
    next(service.notImplemented("Cancel concert"));
  }
);

catalogRouter.post(
  "/admin/concerts/:concert_id/seat-zones",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (_req, _res, next) => {
    next(service.notImplemented("Create seat zone"));
  }
);

catalogRouter.patch(
  "/admin/seat-zones/:seat_zone_id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (_req, _res, next) => {
    next(service.notImplemented("Update seat zone"));
  }
);

catalogRouter.post(
  "/admin/concerts/:concert_id/ticket-types",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (_req, _res, next) => {
    next(service.notImplemented("Create ticket type"));
  }
);

catalogRouter.patch(
  "/admin/ticket-types/:ticket_type_id",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  (_req, _res, next) => {
    next(service.notImplemented("Update ticket type"));
  }
);
