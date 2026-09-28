// Falls back to a fixed dev-only secret if JWT_SECRET isn't set (e.g. no .env file present),
// so the app still works out of the box. Set a real JWT_SECRET in .env for anything beyond
// local testing — anyone with this repo's source can forge tokens against the fallback value.
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-set-JWT_SECRET-in-env";

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET is not set in .env — using an insecure development fallback.");
}

module.exports = { JWT_SECRET };
