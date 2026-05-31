import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  {
    code: "audience",
    name: "Audience",
    description: "Browse public concerts before signing in or buying tickets.",
  },
  {
    code: "customer",
    name: "Customer",
    description: "Buy tickets, manage own orders, and view own e-tickets.",
  },
  {
    code: "organizer",
    name: "Organizer",
    description: "Manage concerts, venues, ticket types, inventory, and sales reports.",
  },
  {
    code: "checkin_staff",
    name: "Check-in staff",
    description: "Scan tickets, validate guests, and sync offline check-in batches.",
  },
  {
    code: "admin",
    name: "Admin",
    description: "Manage all system data, users, roles, permissions, and audit logs.",
  },
];

const permissions = [
  ["catalog:read", "Read public catalog", "View published concerts and public venue data."],
  ["order:create", "Create order", "Create checkout orders for the current user."],
  ["order:read_own", "Read own orders", "Read orders that belong to the current user."],
  ["payment:create", "Create payment", "Create payment requests for own orders."],
  ["ticket:read_own", "Read own tickets", "Read tickets issued to the current user."],
  ["concert:create", "Create concert", "Create organizer-owned concerts."],
  ["concert:update", "Update concert", "Update organizer-owned concert details."],
  ["concert:publish", "Publish concert", "Publish configured concerts."],
  ["concert:cancel", "Cancel concert", "Cancel organizer-owned concerts."],
  ["venue:manage", "Manage venues", "Create and update venues, zones, seat maps, and gates."],
  ["ticket_type:manage", "Manage ticket types", "Create and update ticket types and sale windows."],
  ["inventory:read", "Read inventory", "Read ticket inventory for managed concerts."],
  ["inventory:manage", "Manage inventory", "Adjust and reconcile ticket inventory."],
  ["order:read_concert", "Read concert orders", "Read orders for managed concerts."],
  ["ticket:read_concert", "Read concert tickets", "Read tickets for managed concerts."],
  ["guest_import:manage", "Manage guest imports", "Upload and review guest-list CSV imports."],
  ["artist_bio:manage", "Manage artist bios", "Upload artist bio sources and review generated bios."],
  ["notification:manage", "Manage notifications", "Create and monitor concert/order notifications."],
  ["ticket:checkin", "Check in ticket", "Validate and check in issued tickets."],
  ["guest:checkin", "Check in guest", "Validate and check in guest-list entries."],
  ["offline_checkin:sync", "Sync offline check-in", "Submit and reconcile offline check-in batches."],
  ["user:manage", "Manage users", "Create, update, lock, and restore user accounts."],
  ["rbac:manage", "Manage RBAC", "Assign roles and maintain role permissions."],
  ["audit:read", "Read audit logs", "Read security and business audit trails."],
].map(([code, name, description]) => ({ code, name, description }));

const rolePermissions = {
  audience: ["catalog:read"],
  customer: [
    "catalog:read",
    "order:create",
    "order:read_own",
    "payment:create",
    "ticket:read_own",
  ],
  organizer: [
    "catalog:read",
    "concert:create",
    "concert:update",
    "concert:publish",
    "concert:cancel",
    "venue:manage",
    "ticket_type:manage",
    "inventory:read",
    "inventory:manage",
    "order:read_concert",
    "ticket:read_concert",
    "guest_import:manage",
    "artist_bio:manage",
    "notification:manage",
  ],
  checkin_staff: [
    "catalog:read",
    "ticket:checkin",
    "guest:checkin",
    "offline_checkin:sync",
  ],
  admin: permissions.map((permission) => permission.code),
};

async function main() {
  const roleByCode = new Map();
  const permissionByCode = new Map();

  for (const role of roles) {
    const record = await prisma.role.upsert({
      where: { code: role.code },
      create: role,
      update: {
        name: role.name,
        description: role.description,
      },
    });

    roleByCode.set(role.code, record);
  }

  for (const permission of permissions) {
    const record = await prisma.permission.upsert({
      where: { code: permission.code },
      create: permission,
      update: {
        name: permission.name,
        description: permission.description,
      },
    });

    permissionByCode.set(permission.code, record);
  }

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
    const role = roleByCode.get(roleCode);

    if (!role) {
      throw new Error(`Missing seeded role: ${roleCode}`);
    }

    for (const permissionCode of permissionCodes) {
      const permission = permissionByCode.get(permissionCode);

      if (!permission) {
        throw new Error(`Missing seeded permission: ${permissionCode}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
        update: {},
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
