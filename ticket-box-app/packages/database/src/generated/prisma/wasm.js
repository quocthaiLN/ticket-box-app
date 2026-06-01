
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.0.0
 * Query Engine version: 5dbef10bdbfb579e07d35cc85fb1518d357cb99e
 */
Prisma.prismaVersion = {
  client: "6.0.0",
  engine: "5dbef10bdbfb579e07d35cc85fb1518d357cb99e"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  fullName: 'fullName',
  phone: 'phone',
  role: 'role',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.VenueScalarFieldEnum = {
  id: 'id',
  name: 'name',
  address: 'address',
  city: 'city',
  capacity: 'capacity',
  mapUrl: 'mapUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ConcertScalarFieldEnum = {
  id: 'id',
  venueId: 'venueId',
  organizerId: 'organizerId',
  title: 'title',
  slug: 'slug',
  description: 'description',
  artistName: 'artistName',
  artistBio: 'artistBio',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  status: 'status',
  coverImageUrl: 'coverImageUrl',
  seatMapUrl: 'seatMapUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SeatZoneScalarFieldEnum = {
  id: 'id',
  concertId: 'concertId',
  code: 'code',
  name: 'name',
  description: 'description',
  capacity: 'capacity',
  svgPath: 'svgPath',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CheckinGateScalarFieldEnum = {
  id: 'id',
  concertId: 'concertId',
  code: 'code',
  name: 'name',
  description: 'description',
  isActive: 'isActive',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CheckinGateZoneScalarFieldEnum = {
  gateId: 'gateId',
  seatZoneId: 'seatZoneId',
  concertId: 'concertId',
  createdAt: 'createdAt'
};

exports.Prisma.TicketTypeScalarFieldEnum = {
  id: 'id',
  concertId: 'concertId',
  seatZoneId: 'seatZoneId',
  name: 'name',
  description: 'description',
  price: 'price',
  currency: 'currency',
  totalQuantity: 'totalQuantity',
  heldQuantity: 'heldQuantity',
  soldQuantity: 'soldQuantity',
  maxPerUser: 'maxPerUser',
  saleStartAt: 'saleStartAt',
  saleEndAt: 'saleEndAt',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserTicketTypeCounterScalarFieldEnum = {
  userId: 'userId',
  ticketTypeId: 'ticketTypeId',
  heldQuantity: 'heldQuantity',
  paidQuantity: 'paidQuantity',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  concertId: 'concertId',
  idempotencyKey: 'idempotencyKey',
  status: 'status',
  totalAmount: 'totalAmount',
  currency: 'currency',
  holdExpiresAt: 'holdExpiresAt',
  confirmedAt: 'confirmedAt',
  cancelledAt: 'cancelledAt',
  expiredAt: 'expiredAt',
  cancelledReason: 'cancelledReason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  ticketTypeId: 'ticketTypeId',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  lineTotal: 'lineTotal',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  provider: 'provider',
  providerTransactionId: 'providerTransactionId',
  idempotencyKey: 'idempotencyKey',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  checkoutUrl: 'checkoutUrl',
  providerPayload: 'providerPayload',
  webhookPayload: 'webhookPayload',
  webhookReceivedAt: 'webhookReceivedAt',
  webhookSignatureValid: 'webhookSignatureValid',
  paidAt: 'paidAt',
  failureReason: 'failureReason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TicketScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  orderItemId: 'orderItemId',
  userId: 'userId',
  concertId: 'concertId',
  ticketTypeId: 'ticketTypeId',
  seatZoneId: 'seatZoneId',
  qrTokenHash: 'qrTokenHash',
  qrPayload: 'qrPayload',
  qrSignature: 'qrSignature',
  status: 'status',
  issuedAt: 'issuedAt',
  checkedInAt: 'checkedInAt',
  checkedInById: 'checkedInById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CheckinDeviceScalarFieldEnum = {
  id: 'id',
  deviceCode: 'deviceCode',
  staffId: 'staffId',
  concertId: 'concertId',
  gateId: 'gateId',
  name: 'name',
  status: 'status',
  lastSeenAt: 'lastSeenAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CheckinLogScalarFieldEnum = {
  id: 'id',
  ticketId: 'ticketId',
  guestId: 'guestId',
  concertId: 'concertId',
  seatZoneId: 'seatZoneId',
  gateId: 'gateId',
  deviceId: 'deviceId',
  staffId: 'staffId',
  scanTokenHash: 'scanTokenHash',
  result: 'result',
  reason: 'reason',
  scannedAt: 'scannedAt',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.OfflineCheckinBatchScalarFieldEnum = {
  id: 'id',
  batchToken: 'batchToken',
  deviceId: 'deviceId',
  staffId: 'staffId',
  concertId: 'concertId',
  gateId: 'gateId',
  status: 'status',
  itemCount: 'itemCount',
  acceptedCount: 'acceptedCount',
  conflictCount: 'conflictCount',
  syncedAt: 'syncedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OfflineCheckinItemScalarFieldEnum = {
  id: 'id',
  batchId: 'batchId',
  ticketId: 'ticketId',
  guestId: 'guestId',
  qrTokenHash: 'qrTokenHash',
  gateId: 'gateId',
  seatZoneId: 'seatZoneId',
  result: 'result',
  errorCode: 'errorCode',
  errorMessage: 'errorMessage',
  scannedAt: 'scannedAt',
  syncedAt: 'syncedAt',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.GuestImportJobScalarFieldEnum = {
  id: 'id',
  concertId: 'concertId',
  uploadedById: 'uploadedById',
  fileUrl: 'fileUrl',
  status: 'status',
  totalRows: 'totalRows',
  successRows: 'successRows',
  errorRows: 'errorRows',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.GuestListScalarFieldEnum = {
  id: 'id',
  concertId: 'concertId',
  seatZoneId: 'seatZoneId',
  importJobId: 'importJobId',
  fullName: 'fullName',
  phone: 'phone',
  email: 'email',
  code: 'code',
  status: 'status',
  checkedInAt: 'checkedInAt',
  checkedInById: 'checkedInById',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.GuestImportErrorScalarFieldEnum = {
  id: 'id',
  jobId: 'jobId',
  rowNumber: 'rowNumber',
  rawData: 'rawData',
  errorCode: 'errorCode',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt'
};

exports.Prisma.ArtistBioJobScalarFieldEnum = {
  id: 'id',
  concertId: 'concertId',
  requestedById: 'requestedById',
  status: 'status',
  sourceFileUrl: 'sourceFileUrl',
  extractedText: 'extractedText',
  generatedBio: 'generatedBio',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  concertId: 'concertId',
  ticketId: 'ticketId',
  channel: 'channel',
  type: 'type',
  status: 'status',
  payload: 'payload',
  attempts: 'attempts',
  errorMessage: 'errorMessage',
  sentAt: 'sentAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  actorUserId: 'actorUserId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  metadata: 'metadata',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.UserRole = exports.$Enums.UserRole = {
  AUDIENCE: 'AUDIENCE',
  ORGANIZER: 'ORGANIZER',
  CHECKER: 'CHECKER',
  ADMIN: 'ADMIN'
};

exports.UserStatus = exports.$Enums.UserStatus = {
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  DISABLED: 'DISABLED'
};

exports.ConcertStatus = exports.$Enums.ConcertStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
};

exports.TicketTypeStatus = exports.$Enums.TicketTypeStatus = {
  DRAFT: 'DRAFT',
  ON_SALE: 'ON_SALE',
  SOLD_OUT: 'SOLD_OUT',
  CLOSED: 'CLOSED'
};

exports.OrderStatus = exports.$Enums.OrderStatus = {
  HELD: 'HELD',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

exports.PaymentProvider = exports.$Enums.PaymentProvider = {
  VNPAY: 'VNPAY',
  MOMO: 'MOMO'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

exports.TicketStatus = exports.$Enums.TicketStatus = {
  ISSUED: 'ISSUED',
  CHECKED_IN: 'CHECKED_IN',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

exports.DeviceStatus = exports.$Enums.DeviceStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  LOST: 'LOST'
};

exports.CheckinResult = exports.$Enums.CheckinResult = {
  SUCCESS: 'SUCCESS',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  INVALID_TICKET: 'INVALID_TICKET',
  INVALID_GUEST: 'INVALID_GUEST',
  WRONG_CONCERT: 'WRONG_CONCERT',
  WRONG_GATE: 'WRONG_GATE',
  CONFLICT: 'CONFLICT',
  ERROR: 'ERROR'
};

exports.OfflineBatchStatus = exports.$Enums.OfflineBatchStatus = {
  PENDING: 'PENDING',
  SYNCING: 'SYNCING',
  DONE: 'DONE',
  FAILED: 'FAILED'
};

exports.OfflineItemStatus = exports.$Enums.OfflineItemStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  CONFLICT: 'CONFLICT',
  INVALID: 'INVALID',
  WRONG_GATE: 'WRONG_GATE',
  ERROR: 'ERROR'
};

exports.ImportStatus = exports.$Enums.ImportStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL'
};

exports.GuestStatus = exports.$Enums.GuestStatus = {
  INVITED: 'INVITED',
  CHECKED_IN: 'CHECKED_IN',
  CANCELLED: 'CANCELLED'
};

exports.ArtistBioJobStatus = exports.$Enums.ArtistBioJobStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED'
};

exports.NotificationChannel = exports.$Enums.NotificationChannel = {
  APP: 'APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  ZALO: 'ZALO'
};

exports.NotificationType = exports.$Enums.NotificationType = {
  SYSTEM: 'SYSTEM',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  TICKET_ISSUED: 'TICKET_ISSUED',
  CONCERT_UPDATED: 'CONCERT_UPDATED',
  CHECKIN_ALERT: 'CHECKIN_ALERT',
  ARTIST_BIO_READY: 'ARTIST_BIO_READY'
};

exports.NotificationStatus = exports.$Enums.NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Venue: 'Venue',
  Concert: 'Concert',
  SeatZone: 'SeatZone',
  CheckinGate: 'CheckinGate',
  CheckinGateZone: 'CheckinGateZone',
  TicketType: 'TicketType',
  UserTicketTypeCounter: 'UserTicketTypeCounter',
  Order: 'Order',
  OrderItem: 'OrderItem',
  Payment: 'Payment',
  Ticket: 'Ticket',
  CheckinDevice: 'CheckinDevice',
  CheckinLog: 'CheckinLog',
  OfflineCheckinBatch: 'OfflineCheckinBatch',
  OfflineCheckinItem: 'OfflineCheckinItem',
  GuestImportJob: 'GuestImportJob',
  GuestList: 'GuestList',
  GuestImportError: 'GuestImportError',
  ArtistBioJob: 'ArtistBioJob',
  Notification: 'Notification',
  AuditLog: 'AuditLog'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
