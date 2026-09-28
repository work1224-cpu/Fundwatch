const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// Roles: SuperAdmin, Admin, DataOperator, Viewer, Guest
// `permissions` is a JSON map of module -> [actions] e.g. { "schemes": ["create","read","update","delete"] }
// This keeps RBAC data-driven without needing a separate Permission/RolePermission join table for every module.
const Role = sequelize.define("Role", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.STRING },
  permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
}, { tableName: "roles" });

module.exports = Role;
