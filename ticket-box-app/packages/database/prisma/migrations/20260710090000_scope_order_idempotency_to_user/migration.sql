DROP INDEX IF EXISTS "orders_idempotency_key_key";

CREATE UNIQUE INDEX "orders_user_id_idempotency_key_key"
  ON "orders"("user_id", "idempotency_key");
