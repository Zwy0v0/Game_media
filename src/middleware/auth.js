const jwt = require("jsonwebtoken");

function auth(requiredRole) {
  return (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).json({ error: "No token provided" });
    const JWT_SECRET = process.env.JWT_SECRET || "supersecret"

    jwt.verify(token.split(" ")[1], JWT_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ error: "Invalid token" });

      req.user = decoded;

      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({ error: "Insufficient role" });
      }
      next();
    });
  };
}

module.exports = auth;
