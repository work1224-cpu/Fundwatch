require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize, Role, User } = require("../models");

const ALL = ["create", "read", "update", "delete"];
const READ_ONLY = ["read"];

const ROLE_DEFS = [
  { name: "SuperAdmin", description: "Full unrestricted access", permissions: {} }, // bypassed entirely in rbac.js
  {
    name: "Admin", description: "Manage data, users and imports",
    permissions: { schemes: ALL, categories: ALL, uploads: ALL, users: ALL, watchlist: ALL },
  },
  {
    name: "DataOperator", description: "Import and edit fund data only",
    permissions: { schemes: ["create", "read", "update"], categories: READ_ONLY, uploads: ["create", "read"] },
  },
  {
    name: "Viewer", description: "Read-only access to dashboards and data",
    permissions: { schemes: READ_ONLY, categories: READ_ONLY, uploads: READ_ONLY, watchlist: ALL },
  },
  {
    name: "Guest", description: "Limited read-only access",
    permissions: { schemes: READ_ONLY, categories: READ_ONLY },
  },
];

async function run() {
  await sequelize.authenticate();
  await sequelize.sync();

  for (const def of ROLE_DEFS) {
    await Role.findOrCreate({ where: { name: def.name }, defaults: def });
  }
  console.log("Roles seeded.");

  const email = process.env.SEED_ADMIN_EMAIL || "admin@fundwatch.local";
  const superAdminRole = await Role.findOne({ where: { name: "SuperAdmin" } });
  const existing = await User.findOne({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "Admin@12345", 10);
    await User.create({ name: "Super Admin", email, passwordHash, roleId: superAdminRole.id });
    console.log(`Super admin created: ${email} / ${process.env.SEED_ADMIN_PASSWORD || "Admin@12345"}`);
  } else if (existing.roleId !== superAdminRole.id) {
    // Self-heal: an earlier/partial seed run can leave this user pointing at a role
    // id that no longer exists, which crashes login. Re-point it instead of erroring.
    await existing.update({ roleId: superAdminRole.id });
    console.log("Super admin already existed with a stale roleId — fixed it.");
  } else {
    console.log("Super admin already exists, skipping.");
  }

  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
