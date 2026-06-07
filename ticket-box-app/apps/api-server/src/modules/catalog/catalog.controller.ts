import type { NextFunction, Request, Response } from "express";
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
      res.status(201).json(
        ok(
          await this.service.createConcert(parseCreateConcertBody(req.body), res.locals.auth?.user_id),
          req.requestId
        )
      );
    } catch (err) {
      next(err);
    }
  };

  updateConcert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.updateConcert(req.params.concert_id, parseUpdateConcertBody(req.body)), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  publishConcert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.publishConcert(req.params.concert_id), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  cancelConcert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.cancelConcert(req.params.concert_id), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createSeatZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(
        ok(await this.service.createSeatZone(req.params.concert_id, parseCreateSeatZoneBody(req.body)), req.requestId)
      );
    } catch (err) {
      next(err);
    }
  };

  updateSeatZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.updateSeatZone(req.params.seat_zone_id, parseUpdateSeatZoneBody(req.body)), req.requestId));
    } catch (err) {
      next(err);
    }
  };

  createTicketType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(
        ok(await this.service.createTicketType(req.params.concert_id, parseCreateTicketTypeBody(req.body)), req.requestId)
      );
    } catch (err) {
      next(err);
    }
  };

  updateTicketType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(ok(await this.service.updateTicketType(req.params.ticket_type_id, parseUpdateTicketTypeBody(req.body)), req.requestId));
    } catch (err) {
      next(err);
    }
  };
}
