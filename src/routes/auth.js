const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { register, confirm, login, setupMFA, verifyMFA, respondToMFAChallenge } = require("../controllers/authController");

router.post("/register", register);
router.post("/confirm", confirm);
router.post("/login", login);

// MFA 路由
router.post("/setup-mfa", auth(), setupMFA);
router.post("/verify-mfa", auth(), verifyMFA);
router.post("/respond-mfa", respondToMFAChallenge);

module.exports = router;
