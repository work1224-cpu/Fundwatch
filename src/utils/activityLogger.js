const { ActivityLog } = require("../models");

async function logActivity({ userId, action, module, recordId, oldValue, newValue }) {
  try {
    await ActivityLog.create({ userId, action, module, recordId, oldValue, newValue });
  } catch (err) {
    console.error("Failed to write activity log:", err.message);
  }
}

module.exports = logActivity;
