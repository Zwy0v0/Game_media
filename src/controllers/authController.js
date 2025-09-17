const jwt = require("jsonwebtoken");
const User = require("../models/User");

// 初始化用两个硬编码用户
async function initUsers() {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.create({ username: "admin", password: "admin123", role: "admin" });
    await User.create({ username: "player", password: "player123", role: "user" });
  }
}
initUsers();

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const JWT_SECRET = process.env.JWT_SECRET || "supersecret"
  const token = jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  res.json({ token });
};
