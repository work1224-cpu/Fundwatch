const bcrypt = require("bcryptjs");
const { User, Role } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const logActivity = require("../utils/activityLogger");

exports.list = asyncHandler(async (req, res) => {
  const users = await User.findAll({ include: [Role], attributes: { exclude: ["passwordHash"] } });
  res.json(users);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, roleId } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, roleId });
  await logActivity({ userId: req.user.id, action: "user.create", module: "users", recordId: user.id, newValue: { name, email, roleId } });
  res.status(201).json({ id: user.id, name: user.name, email: user.email });
});

exports.update = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const oldValue = { name: user.name, email: user.email, roleId: user.roleId, isActive: user.isActive };
  const { password, ...rest } = req.body;
  if (password) rest.passwordHash = await bcrypt.hash(password, 10);
  await user.update(rest);
  await logActivity({ userId: req.user.id, action: "user.update", module: "users", recordId: user.id, oldValue, newValue: rest });
  res.json({ id: user.id, name: user.name, email: user.email });
});

exports.remove = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  await user.update({ isActive: false }); // soft delete
  await logActivity({ userId: req.user.id, action: "user.deactivate", module: "users", recordId: user.id });
  res.status(204).send();
});

exports.roles = asyncHandler(async (req, res) => {
  res.json(await Role.findAll());
});
