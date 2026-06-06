import { GuestListRepository } from "./guest-list.repository.js";
import type { GuestImportRequest, GuestScanRequest, GuestSearchQuery } from "./guest-list.types.js";

export class GuestListService {
  constructor(private readonly repository = new GuestListRepository()) {}

  // Gọi repository để tạo job import guest.
  importGuests(input: GuestImportRequest) {
    return this.repository.createImportJob(input);
  }

  // Gọi repository để tìm guest phục vụ admin hoặc checker.
  searchGuests(query: GuestSearchQuery) {
    return this.repository.searchGuests(query);
  }

  // Gọi repository để check-in guest online.
  scanGuest(input: GuestScanRequest) {
    return this.repository.recordGuestScan(input);
  }
}
