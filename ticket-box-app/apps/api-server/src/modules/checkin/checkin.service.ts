import { CheckinRepository } from "./checkin.repository.js";
import type { CheckinPreloadQuery, CheckinScanRequest, OfflineBatchRequest, OfflineSyncRequest } from "./checkin.types.js";

export class CheckinService {
  constructor(private readonly repository = new CheckinRepository()) {}

  scanTicket(input: CheckinScanRequest) {
    return this.repository.recordOnlineScan(input);
  }

  preloadForDevice(query: CheckinPreloadQuery) {
    return this.repository.getPreloadSnapshot(query);
  }

  syncOfflineBatch(input: OfflineSyncRequest) {
    return this.repository.recordOfflineSyncBatch(input);
  }

  createOfflineBatch(input: OfflineBatchRequest) {
    return this.repository.createOfflineBatch(input);
  }
}
