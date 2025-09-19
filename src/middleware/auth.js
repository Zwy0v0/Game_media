const { CognitoJwtVerifier } = require("aws-jwt-verify");

let verifier;
function getVerifier() {
  if (verifier) return verifier;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const tokenUse = process.env.COGNITO_TOKEN_USE || "id"; // "id" or "access"
  if (!userPoolId || !clientId) throw new Error("COGNITO_USER_POOL_ID/COGNITO_CLIENT_ID not set");
  verifier = CognitoJwtVerifier.create({ userPoolId, tokenUse, clientId });
  return verifier;
}

function auth(requiredGroup) {
  return async (req, res, next) => {
    try {
      const hdr = req.headers["authorization"] || "";
      if (!hdr.startsWith("Bearer ")) return res.status(401).json({ error: "No token provided" });
      const token = hdr.slice(7);
      const v = getVerifier();
      const payload = await v.verify(token);
      req.user = {
        sub: payload.sub,
        email: payload.email,
        username: payload["cognito:username"],
        groups: payload["cognito:groups"] || []
      };
      if (requiredGroup && !req.user.groups.includes(requiredGroup)) {
        return res.status(403).json({ error: "Insufficient role" });
      }
      next();
    } catch (e) {
      return res.status(403).json({ error: "Invalid token" });
    }
  };
}

module.exports = auth;
