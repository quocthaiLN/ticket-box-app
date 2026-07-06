import type { NextFunction, Request, Response } from "express";
import {
  invalidateConcertListCache,
  invalidateConcertCache,
  invalidateSeatMapCache,
  invalidateTicketTypeCache,
} from "@ticketbox/redis";
import { collection, ok } from "../../shared/http/response.js";
import {
  parseAdminConcertsQuery,
  parseCatalogListQuery,
  parseCreateConcertBody,
  parseCreateSeatZoneBody,
  parseCreateTicketTypeBody,
  parseCreateVenueBody,
  parseUpdateConcertBody,
  parseUpdateSeatZoneBody,
  parseUpdateTicketTypeBody,
  parseUpdateVenueBody
} from "./catalog.schema.js";
import { CatalogService } from "./catalog.service.js";

export class CatalogController {
  constructor(private readonly service = new CatalogService()) {}

  // ── Public read endpoints ──────────────────────────────────────────────────

  listPublishedConcerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseCatalogListQuery(req.query);
      const concerts = await this.service.listPublishedConcerts(query);
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
  };

  getPublishedConcert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.getPublishedConcert(req.params.concert_id), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  getMetadata = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600");
      res.json(ok(await this.service.getMetadata(req.params.concert_id), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  getSeatMap = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.getSeatMap(req.params.concert_id), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  listTicketTypes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeClosed = req.query.include_closed === "true";
      res.json(ok(await this.service.listTicketTypes(req.params.concert_id, includeClosed), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  getInventory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.setHeader("Cache-Control", "max-age=5");
      res.json(ok(await this.service.getInventory(req.params.concert_id), req.requestId, { consistency: "EVENTUAL" }));
    } catch (err) {
      next(err);
    }
  };

  // ── Admin read endpoints ───────────────────────────────────────────────────

  listVenues = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseCatalogListQuery(req.query);
      const venues = await this.service.listVenues(query);
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
  };

  listAdminConcerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = parseAdminConcertsQuery(req.query);
      const concerts = await this.service.listAdminConcerts(query);
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
  };

  // Admin preview: metadata đầy đủ (kể cả DRAFT), không cache public.
  getAdminConcertMetadata = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.getAdminMetadata(req.params.concert_id), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  // ── Admin write endpoints ──────────────────────────────────────────────────

  createVenue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(ok(await this.service.createVenue(parseCreateVenueBody(req.body)), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  updateVenue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.updateVenue(req.params.venue_id, parseUpdateVenueBody(req.body)), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createConcert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createConcert(
        parseCreateConcertBody(req.body),
        res.locals.auth?.user_id,
      );
      void invalidateConcertListCache();
      res.status(201).json(ok(result, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  updateConcert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const concertId = req.params.concert_id;
      const result = await this.service.updateConcert(concertId, parseUpdateConcertBody(req.body));
      void invalidateConcertCache(concertId);
      res.json(ok(result, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  publishConcert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const concertId = req.params.concert_id;
      const result = await this.service.publishConcert(concertId);
      void invalidateConcertCache(concertId);
      res.json(ok(result, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  cancelConcert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const concertId = req.params.concert_id;
      const result = await this.service.cancelConcert(concertId);
      void invalidateConcertCache(concertId);
      res.json(ok(result, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createSeatZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const concertId = req.params.concert_id;
      const result = await this.service.createSeatZone(concertId, parseCreateSeatZoneBody(req.body));
      void invalidateSeatMapCache(concertId);
      res.status(201).json(ok(result, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  updateSeatZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.updateSeatZone(req.params.seat_zone_id, parseUpdateSeatZoneBody(req.body));
      // Invalidate by concertId if available in the returned data
      const concertId = (result as { concert_id?: string })?.concert_id;
      if (concertId) void invalidateSeatMapCache(concertId);
      res.json(ok(result, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createTicketType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const concertId = req.params.concert_id;
      const result = await this.service.createTicketType(concertId, parseCreateTicketTypeBody(req.body));
      void invalidateTicketTypeCache(concertId);
      res.status(201).json(ok(result, req.requestId));
    } catch (err) {
      next(err);
    }
  };

  updateTicketType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.updateTicketType(req.params.ticket_type_id, parseUpdateTicketTypeBody(req.body));
      const concertId = (result as { concert_id?: string })?.concert_id;
      if (concertId) void invalidateTicketTypeCache(concertId);
      res.json(ok(result, req.requestId));
    } catch (err) {
      next(err);
    }
  };
}

// ── Cache invalidation helpers ─────────────────────────────────────────────

