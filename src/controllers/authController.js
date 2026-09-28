const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Role } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const logActivity = require("../utils/activityLogger");
const { JWT_SECRET } = require("../config/jwt");

function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });
}

exports.register = asyncHandler(async (req, res) => {
  const { name, password, roleName } = req.body;
  const emailAddress = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!name || !emailAddress || !password) return res.status(400).json({ message: "name, email, password are required" });

  const existing = await User.findOne({ where: { email: emailAddress } });
  if (existing) return res.status(409).json({ message: "Email already registered" });

  const role = await Role.findOne({ where: { name: roleName || "Viewer" } });
  if (!role) return res.status(400).json({ message: "Unknown role" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: emailAddress, passwordHash, roleId: role.id });

  await logActivity({ userId: user.id, action: "user.register", module: "users", recordId: user.id, newValue: { email: emailAddress, role: role.name } });

  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: role.name });
});

exports.login = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const emailAddress = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const user = await User.findOne({ where: { email: emailAddress }, include: [Role] });
  if (!user || !user.isActive) return res.status(401).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  if (!user.Role) {
    // Data-integrity issue (e.g. the role this user points to was deleted, or the DB was
    // reseeded out of order). Fail clearly instead of crashing on user.Role.name below.
    return res.status(500).json({
      message: "This user account has no valid role assigned. Delete dev.sqlite and run `npm run seed` again.",
    });
  }

  await user.update({ lastLoginAt: new Date() });
  const token = signToken(user);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.Role.name, permissions: user.Role.permissions },
  });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({
    id: req.user.id, name: req.user.name, email: req.user.email,
    role: req.role.name, permissions: req.role.permissions,
  });
});
