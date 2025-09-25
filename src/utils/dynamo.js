const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { getParam, region } = require("./config");

const ddb = new DynamoDBClient({ region });
const doc = DynamoDBDocumentClient.from(ddb);

// ---- helpers ----
function getCurrentUser(req) {
  if (req && req.auth && req.auth.email) return req.auth.email;
  if (req && req.user && req.user.email) return req.user.email;
  if (req && req.user && req.user.username) return req.user.username;
  return process.env.QUT_USERNAME || "n11866632@qut.edu.au";
}

// ---- task table helpers ----
async function getTableName() {
  if (process.env.DB_TASK_TABLE) return process.env.DB_TASK_TABLE;
  if (process.env.PARAM_DDB_TASK_TABLE) {
    const v = await getParam(process.env.PARAM_DDB_TASK_TABLE);
    if (v) return v;
  }
  throw new Error(
    "Task table not set: neither DB_TASK_TABLE env var nor Parameter Store available"
  );
}

async function putTaskStatus(task, req = null) {
  const TableName = await getTableName();
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");
  const item = {
    "qut-username": qutUsername,
    taskId: task.taskId || task.id,
    ...task,
  };
  await doc.send(new PutCommand({ TableName, Item: item }));
}

async function getTaskStatus(taskId, req = null) {
  const TableName = await getTableName();
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");
  const res = await doc.send(
    new GetCommand({
      TableName,
      Key: { "qut-username": qutUsername, taskId },
      ConsistentRead: true,
    })
  );
  return res.Item || null;
}

async function updateTaskStatus(taskId, attrs, req = null) {
  const TableName = await getTableName();
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");
  const exprNames = {};
  const exprVals = {};
  const sets = [];
  Object.entries(attrs).forEach(([k, v]) => {
    exprNames["#" + k] = k;
    exprVals[":" + k] = v;
    sets.push(`#${k} = :${k}`);
  });
  await doc.send(
    new UpdateCommand({
      TableName,
      Key: { "qut-username": qutUsername, taskId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprVals,
    })
  );
}

// ---- media tables helpers ----
async function getVideosTableName() {
  if (process.env.DDB_VIDEOS_TABLE) return process.env.DDB_VIDEOS_TABLE;
  if (process.env.PARAM_DDB_VIDEOS_TABLE) {
    const v = await getParam(process.env.PARAM_DDB_VIDEOS_TABLE);
    if (v) return v;
  }
  throw new Error(
    "Videos table not set: neither DDB_VIDEOS_TABLE env var nor Parameter Store available"
  );
}

async function getScreenshotsTableName() {
  if (process.env.DDB_SCREENSHOTS_TABLE) return process.env.DDB_SCREENSHOTS_TABLE;
  if (process.env.PARAM_DDB_SCREENSHOTS_TABLE) {
    const v = await getParam(process.env.PARAM_DDB_SCREENSHOTS_TABLE);
    if (v) return v;
  }
  throw new Error(
    "Screenshots table not set: neither DDB_SCREENSHOTS_TABLE env var nor Parameter Store available"
  );
}

// ---- Videos ----
async function createVideo(item, req = null) {
  const TableName = await getVideosTableName();
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";

  // 注意顺序：先展开 item，最后强制写入固定邮箱，避免被覆盖
  const videoItem = {
    ...item,
    "qut-username": qutUsername,
  };

  await doc.send(new PutCommand({ TableName, Item: videoItem }));
  return videoItem;
}

async function getVideo(id, req = null) {
  const TableName = await getVideosTableName();
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";

  const r = await doc.send(
    new GetCommand({
      TableName,
      Key: { "qut-username": qutUsername, id },
      ConsistentRead: true, // 刚写完立即读需要强一致
    })
  );
  return r.Item || null;
}

async function listVideosByOwner(owner, req = null) {
  const TableName = await getVideosTableName();
  if (owner) {
    const r = await doc.send(
      new ScanCommand({
        TableName,
        FilterExpression: "#pk = :username",
        ExpressionAttributeNames: { "#pk": "qut-username" },
        ExpressionAttributeValues: { ":username": owner },
        ConsistentRead: true,
      })
    );
    return r.Items || [];
  } else {
    const r = await doc.send(new ScanCommand({ TableName, ConsistentRead: true }));
    return r.Items || [];
  }
}

async function updateVideo(id, attrs, req = null) {
  const TableName = await getVideosTableName();
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");

  const exprNames = {};
  const exprVals = {};
  const sets = [];
  Object.entries(attrs).forEach(([k, v]) => {
    exprNames["#" + k] = k;
    exprVals[":" + k] = v;
    sets.push(`#${k} = :${k}`);
  });

  await doc.send(
    new UpdateCommand({
      TableName,
      Key: { "qut-username": qutUsername, id },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprVals,
    })
  );
}

async function deleteVideo(id, req = null) {
  const TableName = await getVideosTableName();
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  await doc.send(
    new DeleteCommand({
      TableName,
      Key: { "qut-username": qutUsername, id },
    })
  );
}

// ---- Screenshots ----
async function createScreenshot(item, req = null) {
  const TableName = await getScreenshotsTableName();
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";

  const screenshotItem = {
    ...item,
    "qut-username": qutUsername, // 放最后，确保不被覆盖
  };

  await doc.send(new PutCommand({ TableName, Item: screenshotItem }));
  return screenshotItem;
}

async function getScreenshot(id, req = null) {
  const TableName = await getScreenshotsTableName();
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";

  const r = await doc.send(
    new GetCommand({
      TableName,
      Key: { "qut-username": qutUsername, id },
      ConsistentRead: true,
    })
  );
  return r.Item || null;
}

async function listScreenshotsByOwner(owner, req = null) {
  const TableName = await getScreenshotsTableName();
  if (owner) {
    const r = await doc.send(
      new ScanCommand({
        TableName,
        FilterExpression: "#pk = :username",
        ExpressionAttributeNames: { "#pk": "qut-username" },
        ExpressionAttributeValues: { ":username": owner },
        ConsistentRead: true,
      })
    );
    return r.Items || [];
  } else {
    const r = await doc.send(new ScanCommand({ TableName, ConsistentRead: true }));
    return r.Items || [];
  }
}

async function updateScreenshot(id, attrs, req = null) {
  const TableName = await getScreenshotsTableName();
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");

  const exprNames = {};
  const exprVals = {};
  const sets = [];
  Object.entries(attrs).forEach(([k, v]) => {
    exprNames["#" + k] = k;
    exprVals[":" + k] = v;
    sets.push(`#${k} = :${k}`);
  });

  await doc.send(
    new UpdateCommand({
      TableName,
      Key: { "qut-username": qutUsername, id },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprVals,
    })
  );
}

async function deleteScreenshot(id, req = null) {
  const TableName = await getScreenshotsTableName();
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";

  await doc.send(
    new DeleteCommand({
      TableName,
      Key: { "qut-username": qutUsername, id },
    })
  );
}

module.exports = {
  putTaskStatus,
  getTaskStatus,
  updateTaskStatus,
};

module.exports.media = {
  createVideo,
  getVideo,
  listVideosByOwner,
  updateVideo,
  deleteVideo,
  createScreenshot,
  getScreenshot,
  listScreenshotsByOwner,
  updateScreenshot,
  deleteScreenshot,
};
