import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  prisma,
  Prisma,
  OrderStatus,
  PaymentStatus,
  PaymentProvider,
  TicketStatus,
  NotificationChannel,
  NotificationType,
} from "@ticketbox/database";
import { cacheDelete } from "@ticketbox/redis";
import { Errors } from "../../shared/http/problem-details.js";

// Xóa cache tồn kho sau khi trạng thái giữ/bán vé thay đổi.
const inventoryCacheKey = (ticketTypeId: string) => `inventory:${ticketTypeId}`;

// Các kiểu dữ liệu rút gọn cho từng truy vấn đọc.
type OrderForRetryRow = {
  id: string;
  userId: string;
  status: string;
  totalAmount: string;
  currency: string;
  holdExpiresAt: Date | null;
};

type PendingPaymentRow = {
  id: string;
  status: string;
};

type PaymentForWebhookRow = {
  id: string;
  orderId: string;
  status: string;
  amount: string;
};

type OrderItemForTicketRow = {
  itemId: string;
  ticketTypeId: string;
  seatZoneId: string;
  concertId: string;
  userId: string;
  quantity: number;
};

// Kiểm tra order có tồn tại, thuộc user và còn đủ điều kiện để tạo payment attempt.
export async function getOrderForRetry(
  orderId: string,
  userId: string,
): Promise<OrderForRetryRow> {
  // Lấy order cần tạo payment attempt mới.
  const [row] = await prisma.$queryRaw<OrderForRetryRow[]>(Prisma.sql`
    SELECT
      id,
      user_id AS "userId",
      status::text AS "status",
      total_amount::text AS "totalAmount",
      currency,
      hold_expires_at AS "holdExpiresAt"
    FROM orders
    WHERE id = ${orderId}::uuid
  `);

  // Chỉ chủ sở hữu mới được tạo payment cho order còn trong thời hạn giữ.
  if (!row) {
    throw Errors.orderNotFoundById();
  }
  if (row.userId !== userId) {
    throw Errors.orderAccessDenied();
  }
  if (row.status !== OrderStatus.HELD) {
    throw Errors.orderNotHeld(`Order is in status ${row.status} and cannot create a new payment.`);
  }
  if (row.holdExpiresAt && row.holdExpiresAt < new Date()) {
    throw Errors.orderNotHeld("Order hold has expired.");
  }

  return row;
}

// Trả về payment PENDING hiện có của order để ngăn tạo giao dịch trùng.
export async function getActivePendingPayment(
  orderId: string,
): Promise<PendingPaymentRow | null> {
  // Chặn việc tạo nhiều payment PENDING cùng lúc cho một order.
  const [row] = await prisma.$queryRaw<PendingPaymentRow[]>(Prisma.sql`
    SELECT id, status::text AS "status"
    FROM payments
    WHERE order_id = ${orderId}::uuid AND status = 'PENDING'
    LIMIT 1
  `);
  return row ?? null;
}

// Tạo bản ghi payment PENDING sau khi đã có checkout URL từ provider.
export async function createPaymentRecord(
  orderId: string,
  amount: string,
  currency: string,
  provider: "VNPAY" | "MOMO",
  checkoutUrl: string,
): Promise<{ id: string; status: string; checkoutUrl: string }> {
  // Mỗi payment attempt có idempotency key riêng để không trùng bản ghi.
  const idempotencyKey = `retry:${orderId}:${provider}:${randomUUID()}`;

  // Lưu payment ở trạng thái chờ webhook/xác nhận từ nhà cung cấp.
  const payment = await prisma.payment.create({
    data: {
      orderId,
      provider:
        provider === "VNPAY" ? PaymentProvider.VNPAY : PaymentProvider.MOMO,
      idempotencyKey,
      amount: new Prisma.Decimal(amount),
      currency,
      status: PaymentStatus.PENDING,
      checkoutUrl,
    },
  });

  return {
    id: payment.id,
    status: payment.status,
    checkoutUrl: payment.checkoutUrl ?? checkoutUrl,
  };
}

// Tìm payment PENDING gần nhất khớp order và provider khi nhận webhook.
export async function findPendingPaymentForWebhook(
  orderId: string,
  provider: "VNPAY" | "MOMO",
): Promise<PaymentForWebhookRow | null> {
  // Đổi provider từ request sang enum tương ứng trong database.
  const providerEnum =
    provider === "VNPAY" ? PaymentProvider.VNPAY : PaymentProvider.MOMO;

  // Tìm lần thanh toán PENDING mới nhất để xử lý webhook.
  const [row] = await prisma.$queryRaw<PaymentForWebhookRow[]>(Prisma.sql`
    SELECT id, order_id AS "orderId", status::text AS "status", amount::text AS "amount"
    FROM payments
    WHERE order_id = ${orderId}::uuid
      AND provider = ${providerEnum}::"payment_provider"
      AND status = 'PENDING'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return row ?? null;
}

// Tìm payment theo mã giao dịch provider để xử lý webhook một cách idempotent.
export async function findPaymentByProviderTxn(
  provider: "VNPAY" | "MOMO",
  providerTransactionId: string,
): Promise<{ id: string; status: string; orderId: string } | null> {
  // Webhook retry dùng mã giao dịch của provider để nhận diện payment đã xử lý.
  const providerEnum =
    provider === "VNPAY" ? PaymentProvider.VNPAY : PaymentProvider.MOMO;

  const [row] = await prisma.$queryRaw<
    { id: string; status: string; orderId: string }[]
  >(Prisma.sql`
    SELECT id, status::text AS "status", order_id AS "orderId"
    FROM payments
    WHERE provider = ${providerEnum}::"payment_provider"
      AND provider_transaction_id = ${providerTransactionId}
    LIMIT 1
  `);
  return row ?? null;
}

// Lưu payload webhook, thời điểm nhận và kết quả kiểm tra chữ ký để truy vết.
export async function saveWebhookRawPayload(
  paymentId: string,
  rawPayload: unknown,
  signatureValid: boolean,
  providerTransactionId: string | null,
): Promise<void> {
  // Lưu payload gốc và kết quả kiểm tra chữ ký để audit/reconcile.
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      webhookPayload: rawPayload as Prisma.InputJsonValue,
      webhookReceivedAt: new Date(),
      webhookSignatureValid: signatureValid,
      ...(providerTransactionId ? { providerTransactionId } : {}),
    },
  });
}

export type ConfirmOrderPaymentResult = {
  issuedNotifications: Array<{
    id: string;
    userId: string;
    channel: string;
    payload: Record<string, unknown>;
  }>;
  issuedTickets: Array<{
    id: string;
    userId: string;
    concertId: string;
  }>;
};

// Xác nhận payment, chuyển hold thành vé đã bán, phát hành ticket và notification.
export async function confirmOrderPayment(
  paymentId: string,
  orderId: string,
): Promise<ConfirmOrderPaymentResult> {
  // Thu thập dữ liệu sau transaction để xóa cache và gửi notification.
  let affectedTicketTypeIds: string[] = [];
  let issuedTickets: ConfirmOrderPaymentResult["issuedTickets"] = [];
  let issuedNotifications: ConfirmOrderPaymentResult["issuedNotifications"] =
    [];

  await prisma.$transaction(
    async (tx) => {
      // Khóa order để webhook đồng thời không thể xác nhận hai lần.
      const [orderRow] = await tx.$queryRaw<
        Array<{ status: string }>
      >(Prisma.sql`
      SELECT status::text AS "status"
      FROM orders
      WHERE id = ${orderId}::uuid
      FOR UPDATE
    `);

      if (!orderRow) throw Errors.orderNotFoundById();

      // Idempotent: already confirmed — still ensure payment is SUCCEEDED
      if (orderRow.status === OrderStatus.CONFIRMED) {
        await tx.payment
          .update({
            where: { id: paymentId },
            data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
          })
          .catch(() => {
            /* already SUCCEEDED, ignore */
          });
        return;
      }

      if (orderRow.status !== OrderStatus.HELD) {
        throw Errors.orderNotHeldConflict(orderRow.status);
      }

      // Chuyển order và payment sang trạng thái hoàn tất tại cùng một thời điểm.
      const now = new Date();

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED, confirmedAt: now },
      });

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.SUCCEEDED, paidAt: now },
      });

      // Fetch order items with seat zone info for inventory + ticket issuance
      const items = await tx.$queryRaw<OrderItemForTicketRow[]>(Prisma.sql`
      SELECT
        oi.id AS "itemId",
        oi.ticket_type_id AS "ticketTypeId",
        tt.seat_zone_id AS "seatZoneId",
        o.concert_id AS "concertId",
        o.user_id AS "userId",
        oi.quantity
      FROM order_items oi
      JOIN ticket_types tt ON tt.id = oi.ticket_type_id
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.order_id = ${orderId}::uuid
    `);

      // Mỗi vé chỉ được vào đúng 1 cổng. Một khu ghế có thể được phục vụ bởi
      // nhiều cổng (CheckinGateZone), nên ta chia tải giữa các cổng đó bằng cách
      // gán NGẪU NHIÊN — không trạng thái, không đọc/ghi bộ đếm chung. Cách này
      // tránh tranh chấp serializable dưới tải đặt vé cao (hàng nghìn req/s) mà
      // vẫn cho phân bố xấp xỉ đều theo luật số lớn.
      // Danh sách cổng active của mỗi zone là dữ liệu cấu hình gần như bất biến,
      // chỉ đọc 1 lần cho mỗi zone (read-only, không xung đột với insert vé).
      const zoneGates = new Map<string, string[]>();
      for (const zoneId of new Set(items.map((i) => i.seatZoneId))) {
        const gates = await tx.$queryRaw<Array<{ gateId: string }>>(Prisma.sql`
        SELECT cg.id AS "gateId"
        FROM checkin_gate_zones cgz
        JOIN checkin_gates cg ON cg.id = cgz.gate_id AND cg.concert_id = cgz.concert_id
        WHERE cgz.seat_zone_id = ${zoneId}::uuid
          AND cg.is_active = true
        ORDER BY cg.sort_order ASC, cg.id ASC
      `);
        if (gates.length === 0) {
          // gateId là bắt buộc trên Ticket; không có cổng active thì không thể phát hành.
          throw new Error(`Không có cổng active phục vụ khu ghế ${zoneId} để phát hành vé`);
        }
        zoneGates.set(
          zoneId,
          gates.map((g) => g.gateId),
        );
      }

      // Chọn ngẫu nhiên một cổng active của zone cho mỗi vé.
      const pickGateForZone = (zoneId: string): string => {
        const gates = zoneGates.get(zoneId)!;
        return gates[randomInt(gates.length)];
      };

      // Lưu các ticket phát hành để tạo notification trước khi commit.
      // Danh sách này được dùng để tạo notification ngay trong transaction,
      // bảo đảm không có ticket phát hành mà thiếu bản ghi notification.
      const createdTickets: ConfirmOrderPaymentResult["issuedTickets"] = [];

      // Cập nhật số lượng vé held và sold của một ticket_types
      // Mỗi order item có thể đại diện cho nhiều vé cùng một ticket type.
      for (const item of items) {
        // Move held → sold
        // Chuyển đúng số lượng đã giữ sang đã bán. GREATEST bảo vệ số held
        // không âm; transaction serializable bảo vệ cạnh tranh giữa request.
        await tx.$executeRaw(Prisma.sql`
        UPDATE ticket_types
        SET
          held_quantity = GREATEST(0, held_quantity - ${item.quantity}),
          sold_quantity = sold_quantity + ${item.quantity}
        WHERE id = ${item.ticketTypeId}::uuid
      `);

        // Cập nhật số lượng vé held và sold của một user - dùng để giới hạn số lượng mua
        // Đồng bộ quota user: held giảm, paid tăng để áp dụng giới hạn mua vé.
        await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters utc
        SET
          held_quantity = GREATEST(0, utc.held_quantity - ${item.quantity}),
          paid_quantity = utc.paid_quantity + ${item.quantity}
        FROM orders o
        WHERE o.id = ${orderId}::uuid
          AND utc.user_id = o.user_id
          AND utc.ticket_type_id = ${item.ticketTypeId}::uuid
      `);

        // Issue one ticket per quantity unit
        for (let i = 0; i < item.quantity; i++) {
          // Mỗi ticket có token riêng: order/item/index giúp truy vết, còn bytes
          // ngẫu nhiên giúp token không thể đoán từ dữ liệu order công khai.
          const rawToken = `${orderId}:${item.itemId}:${i}:${randomBytes(8).toString("hex")}`;
          // Chỉ lưu hash; token thô chỉ nên được dùng khi tạo QR hoặc gửi cho user.
          const qrTokenHash = createHash("sha256")
            .update(rawToken, "utf8")
            .digest("hex");

          // Gắn ticket vào đủ ngữ cảnh để check-in xác định được người sở hữu,
          // concert, loại vé và khu ghế mà không cần suy luận lại từ order.
          const ticket = await tx.ticket.create({
            data: {
              orderId,
              orderItemId: item.itemId,
              userId: item.userId,
              concertId: item.concertId,
              ticketTypeId: item.ticketTypeId,
              seatZoneId: item.seatZoneId,
              gateId: pickGateForZone(item.seatZoneId),
              qrTokenHash,
              status: TicketStatus.ISSUED,
              issuedAt: now,
            },
          });

          // Thu thập ticket vừa phát hành cho bước tạo notification trong transaction.
          createdTickets.push({
            id: ticket.id,
            userId: item.userId,
            concertId: item.concertId,
          });
        }
      }

      // Tạo notification trong cùng transaction với việc phát hành ticket.
      // Notification là outbox record; email chỉ được enqueue sau khi transaction commit.
      const createdNotifications: typeof issuedNotifications = [];
      for (const t of createdTickets) {
        // Payload chỉ mang định danh; worker đọc thêm dữ liệu khi cần render email.
        const notifPayload = {
          ticket_id: t.id,
          order_id: orderId,
        } as Prisma.InputJsonValue;
        // Không gửi email ở đây để tránh giữ lock database khi dịch vụ ngoài chậm/lỗi.
        const notif = await tx.notification.create({
          data: {
            userId: t.userId,
            concertId: t.concertId,
            ticketId: t.id,
            channel: NotificationChannel.EMAIL,
            type: NotificationType.TICKET_ISSUED,
            payload: notifPayload,
          },
        });
        // Chuẩn bị dữ liệu cho service enqueue sau khi transaction đã commit.
        createdNotifications.push({
          id: notif.id,
          userId: t.userId,
          channel: "EMAIL",
          payload: { ticket_id: t.id, order_id: orderId },
        });
      }
      issuedTickets = createdTickets;
      issuedNotifications = createdNotifications;
      // Ghi nhận các loại vé bị thay đổi để xóa cache sau khi commit.
      affectedTicketTypeIds = [...new Set(items.map((i) => i.ticketTypeId))];
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      // Phát hành vé chạy nhiều query tuần tự; với DB có độ trễ mạng cao (vd Neon
      // khác region) tổng thời gian dễ vượt 5000ms mặc định của Prisma và làm
      // transaction bị đóng (P2028). Nới timeout để webhook xác nhận không bị hủy giữa chừng.
      timeout: 30_000,
      maxWait: 10_000,
    },
  );

  // Cache không được xóa thành công không làm rollback thanh toán đã commit.
  await Promise.allSettled(
    affectedTicketTypeIds.map((id) => cacheDelete(inventoryCacheKey(id))),
  );

  return { issuedNotifications, issuedTickets };
}

// Đánh dấu payment thất bại và giải phóng hold/tồn kho nếu order chưa được xác nhận.
export async function failPayment(
  paymentId: string,
  orderId: string,
  failureReason: string,
): Promise<void> {
  // Chỉ xóa cache cho các loại vé thực sự được giải phóng.
  let affectedTicketTypeIds: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      // Khóa payment để webhook lặp lại không giải phóng hold nhiều lần.
      const [paymentRow] = await tx.$queryRaw<
        Array<{ status: string }>
      >(Prisma.sql`
      SELECT status::text AS "status" FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE
    `);

      // Không có payment hoặc payment đã được xử lý trước đó: webhook retry không
      // được phép đổi trạng thái hay trả tồn kho lần thứ hai.
      // !paymentRow = không tồn tại payment này -> đã được xử lý rồi
      // paymentRow.status !== PaymentStatus.PENDING = nếu đã tồn tại và không phải PENDING cũng không được xử lý
      if (!paymentRow || paymentRow.status !== PaymentStatus.PENDING) return;

      // Ghi lại nguyên nhân provider báo thất bại để audit và hỗ trợ retry sau này.
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.FAILED, failureReason },
      });

      // Khóa order đang HELD và lấy số lượng từng ticket type phải trả. Điều kiện
      // HELD tránh hủy nhầm order đã CONFIRMED hoặc đã bị cancel/expire trước đó.
      const items = await tx.$queryRaw<
        Array<{ ticketTypeId: string; quantity: number }>
      >(Prisma.sql`
      SELECT
        o.status::text AS "orderStatus",
        oi.ticket_type_id AS "ticketTypeId",
        oi.quantity
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ${orderId}::uuid
        AND o.status = 'HELD'
      FOR UPDATE OF o
    `);

      // Payment vẫn FAILED, nhưng không đụng inventory nếu order không còn HELD.
      if (items.length === 0) return;

      // Hủy order do thanh toán thất bại trước khi trả tồn kho.
      await tx.$executeRaw(Prisma.sql`
      UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_reason = 'PAYMENT_FAILED'
      WHERE id = ${orderId}::uuid AND status = 'HELD'
    `);

      for (const item of items) {
        // Hoàn trả global inventory trước để ticket type có thể được mua lại.
        // Trả số lượng vé và quota giữ chỗ về trạng thái có thể mua lại.
        await tx.$executeRaw(Prisma.sql`
        UPDATE ticket_types
        SET held_quantity = GREATEST(0, held_quantity - ${item.quantity})
        WHERE id = ${item.ticketTypeId}::uuid
      `);
        // Hoàn trả phần hold của đúng user để quota mua vé không bị giữ sai.
        await tx.$executeRaw(Prisma.sql`
        UPDATE user_ticket_type_counters utc
        SET held_quantity = GREATEST(0, utc.held_quantity - ${item.quantity})
        FROM orders o
        WHERE o.id = ${orderId}::uuid
          AND utc.user_id = o.user_id
          AND utc.ticket_type_id = ${item.ticketTypeId}::uuid
      `);
      }

      // Chỉ lưu ticket type duy nhất; cache được xóa một lần cho mỗi loại vé.
      affectedTicketTypeIds = [...new Set(items.map((i) => i.ticketTypeId))];
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      // Cùng lý do với confirmOrderPayment: nhiều query tuần tự + độ trễ mạng cao
      // có thể vượt 5000ms mặc định và gây P2028.
      timeout: 30_000,
      maxWait: 10_000,
    },
  );

  // Xóa cache tồn kho sau khi transaction giải phóng hold đã commit.
  await Promise.allSettled(
    affectedTicketTypeIds.map((id) => cacheDelete(inventoryCacheKey(id))),
  );
}
