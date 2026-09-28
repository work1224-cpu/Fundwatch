const jwt = require("jsonwebtoken");
const { User, Role } = require("../models");
const { JWT_SECRET } = require("../config/jwt");

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing bearer token" });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id, { include: [Role] });
    if (!user || !user.isActive) return res.status(401).json({ message: "Invalid or inactive user" });

    req.user = user;
    req.role = user.Role;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = authenticate;
