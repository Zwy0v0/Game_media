const express = require("express");
const router = express.Router();
const { register, confirm, login } = require("../controllers/authController");

router.post("/register", register);
router.post("/confirm", confirm);
router.post("/login", login);

module.exports = router;
