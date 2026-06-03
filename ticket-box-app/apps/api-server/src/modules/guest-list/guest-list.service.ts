import { GuestListRepository } from "./guest-list.repository.js";
import type { GuestImportRequest, GuestScanRequest, GuestSearchQuery } from "./guest-list.types.js";

export class GuestListService {
  constructor(private readonly repository = new GuestListRepository()) {}

  importGuests(input: GuestImportRequest) {
    return this.repository.createImportJob(input);
  }

  searchGuests(query: GuestSearchQuery) {
    return this.repository.searchGuests(query);
  }

  scanGuest(input: GuestScanRequest) {
    return this.repository.recordGuestScan(input);
  }
}
