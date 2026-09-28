// Usage: router.post('/schemes', authenticate, can('schemes', 'create'), controller.create)
// A role's `permissions` JSON looks like: { "schemes": ["create","read","update","delete"], "users": ["read"] }
// SuperAdmin bypasses the check entirely.
function can(module, action) {
  return (req, res, next) => {
    const role = req.role;
    if (!role) return res.status(403).json({ message: "No role assigned" });
    if (role.name === "SuperAdmin") return next();

    const allowed = role.permissions && role.permissions[module];
    if (Array.isArray(allowed) && allowed.includes(action)) return next();

    return res.status(403).json({ message: `Forbidden: ${role.name} cannot ${action} ${module}` });
  };
}

module.exports = can;
