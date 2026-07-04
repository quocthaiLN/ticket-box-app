// Canonical implementation now lives in @ticketbox/database so the worker and all
// modules share one copy. Re-exported here to keep existing import paths stable.
export {
  withSerializableRetry,
  type SerializableRetryOptions,
} from "@ticketbox/database";
