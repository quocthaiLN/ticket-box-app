import { GuestListRepository } from "./guest-list.repository.js";
import type { GuestScanRequest, GuestSearchQuery } from "./guest-list.types.js";

export class GuestListService {
  constructor(private readonly repository = new GuestListRepository()) {}

  // Admin chạy nhập thủ công cho 1 concert (enqueue job quét Drive).
  triggerImport(concertId: string) {
    return this.repository.triggerConcertImport(concertId);
  }

  // Vé khách mời (QR mã mời) cho link tải trong email.
  getInviteTicket(concertId: string, code: string) {
    return this.repository.findGuestForInviteTicket(concertId, code);
  }

  // Trạng thái 1 job import.
  getImportJob(jobId: string) {
    return this.repository.getImportJob(jobId);
  }

  // Danh sách job import của 1 concert.
  listImportJobs(concertId: string, limit: number) {
    return this.repository.listImportJobs(concertId, limit);
  }

  // Lỗi từng dòng của 1 job (phân trang cursor).
  listImportErrors(jobId: string, limit: number, cursor?: string) {
    return this.repository.listImportErrors(jobId, limit, cursor);
  }

  // Tìm guest phục vụ admin hoặc checker.
  searchGuests(query: GuestSearchQuery) {
    return this.repository.searchGuests(query);
  }

  // Check-in guest online.
  scanGuest(input: GuestScanRequest) {
    return this.repository.recordGuestScan(input);
  }
}
