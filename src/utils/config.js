const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-2";
const ssm = new SSMClient({ region });
const secrets = new SecretsManagerClient({ region });

const parameterCache = new Map();
const secretCache = new Map();

async function getParameter(name, withDecryption = true) {
  if (parameterCache.has(name)) return parameterCache.get(name);
  const cmd = new GetParameterCommand({ Name: name, WithDecryption: withDecryption });
  const res = await ssm.send(cmd);
  const value = res?.Parameter?.Value;
  parameterCache.set(name, value);
  return value;
}

async function getSecretJson(secretId) {
  if (secretCache.has(secretId)) return secretCache.get(secretId);
  const cmd = new GetSecretValueCommand({ SecretId: secretId });
  const res = await secrets.send(cmd);
  const str = res.SecretString || Buffer.from(res.SecretBinary || "").toString("utf8");
  const obj = JSON.parse(str);
  secretCache.set(secretId, obj);
  return obj;
}

module.exports = { getParameter, getSecretJson, region };


