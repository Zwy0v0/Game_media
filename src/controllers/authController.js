const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-2";
const client = new CognitoIdentityProviderClient({ region });

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "username, email, password required" });
  try {
    const cmd = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: username,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email }
      ]
    });
    const out = await client.send(cmd);
    res.json({ userSub: out.UserSub, codeDelivery: out.CodeDeliveryDetails });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
};

exports.confirm = async (req, res) => {
  const { username, code } = req.body;
  if (!username || !code) return res.status(400).json({ error: "username, code required" });
  try {
    const cmd = new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: username,
      ConfirmationCode: code
    });
    await client.send(cmd);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username, password required" });
  try {
    const cmd = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: username, PASSWORD: password }
    });
    const out = await client.send(cmd);
    res.json(out.AuthenticationResult);
  } catch (e) {
    res.status(401).json({ error: e.message || String(e) });
  }
};
