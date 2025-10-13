const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getParam, region } = require("./config");
const jwt = require("jsonwebtoken");

const ddb = new DynamoDBClient({ region });
const doc = DynamoDBDocumentClient.from(ddb);

// 获取当前用户标识符
function getCurrentUser(req) {
  // 优先从 ID Token 解析用户邮箱
  if (req.auth && req.auth.email) {
    return req.auth.email;
  }
  
  // 从 JWT token 中解析用户邮箱
  if (req.user && req.user.email) {
    return req.user.email;
  }
  
  // 从 Cognito username 解析
  if (req.user && req.user.username) {
    return req.user.username;
  }
  
  // 回退到环境变量
  return process.env.QUT_USERNAME || "n11866632@qut.edu.au";
}

async function getTableName() {
  // 优先读取 .env 里的表名
  if (process.env.DB_TASK_TABLE && String(process.env.DB_TASK_TABLE).trim()) {
    return process.env.DB_TASK_TABLE;
  }

  // 如果 .env 没有，则从 Parameter Store 读取
  if (process.env.PARAM_DDB_TASK_TABLE) {
    const tableName = await getParam(process.env.PARAM_DDB_TASK_TABLE);
    if (tableName && String(tableName).trim()) {
      return tableName;
    }
  }

  // 默认表名（按用户要求）
  return "game-media-tasks";
}

async function putTaskStatus(task, req = null) {
  const TableName = await getTableName();
  if (!TableName) return;
  
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");
  const item = {
    "qut-username": qutUsername,
    "taskId": task.taskId || task.id,
    ...task
  };
  
  await doc.send(new PutCommand({ TableName, Item: item }));
}

async function getTaskStatus(taskId, req = null) {
  const TableName = await getTableName();
  if (!TableName) return null;
  
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");
  const res = await doc.send(new GetCommand({ 
    TableName, 
    Key: { 
      "qut-username": qutUsername,
      "taskId": taskId 
    } 
  }));
  return res.Item || null;
}

async function updateTaskStatus(taskId, attrs, req = null) {
  const TableName = await getTableName();
  if (!TableName) return;
  
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");
  const exprNames = {};
  const exprVals = {};
  const sets = [];
  Object.entries(attrs).forEach(([k, v], i) => {
    exprNames["#" + k] = k;
    exprVals[":" + k] = v;
    sets.push(`#${k} = :${k}`);
  });
  await doc.send(new UpdateCommand({
    TableName,
    Key: { 
      "qut-username": qutUsername,
      "taskId": taskId 
    },
    UpdateExpression: `SET ${sets.join(", ")}`,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprVals
  }));
}

module.exports = { putTaskStatus, getTaskStatus, updateTaskStatus };

// ---- Media tables helpers ----
async function getVideosTableName() {
  // 优先读取 .env 里的表名
  if (process.env.DDB_VIDEOS_TABLE && String(process.env.DDB_VIDEOS_TABLE).trim()) {
    return process.env.DDB_VIDEOS_TABLE;
  }

  // 如果 .env 没有，则从 Parameter Store 读取
  if (process.env.PARAM_DDB_VIDEOS_TABLE) {
    const tableName = await getParam(process.env.PARAM_DDB_VIDEOS_TABLE);
    if (tableName && String(tableName).trim()) {
      return tableName;
    }
  }

  // 默认表名（按用户要求）
  return "game-media-videos";
}
async function getScreenshotsTableName() {
  // 优先读取 .env 里的表名
  if (process.env.DDB_SCREENSHOTS_TABLE && String(process.env.DDB_SCREENSHOTS_TABLE).trim()) {
    return process.env.DDB_SCREENSHOTS_TABLE;
  }

  // 如果 .env 没有，则从 Parameter Store 读取
  if (process.env.PARAM_DDB_SCREENSHOTS_TABLE) {
    const tableName = await getParam(process.env.PARAM_DDB_SCREENSHOTS_TABLE);
    if (tableName && String(tableName).trim()) {
      return tableName;
    }
  }

  // 默认表名（按用户要求）
  return "game-media-screenshots";
}

async function createVideo(item, req = null) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  // 强制使用固定的学号邮箱，不依赖 req.user
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  const videoItem = {
    "qut-username": qutUsername,
    "id": item.id,
    ...item
  };
  
  await doc.send(new PutCommand({ TableName, Item: videoItem }));
  return videoItem;
}

async function getVideo(id, req = null) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  // 统一使用固定的学号邮箱，与 createVideo 保持一致
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  const r = await doc.send(new GetCommand({ 
    TableName, 
    Key: { 
      "qut-username": qutUsername,
      "id": id 
    } 
  }));
  return r.Item || null;
}

async function listVideosByOwner(owner, req = null) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  
  if (owner) {
    // 普通用户：使用 Scan + FilterExpression 查询特定用户的所有视频
    const r = await doc.send(new ScanCommand({
      TableName,
      FilterExpression: "#pk = :username",
      ExpressionAttributeNames: { 
        "#pk": "qut-username"
      },
      ExpressionAttributeValues: { 
        ":username": owner
      }
    }));
    return r.Items || [];
  } else {
    // Admin 用户：直接 Scan 所有视频
    const r = await doc.send(new ScanCommand({ TableName }));
    return r.Items || [];
  }
}

async function updateVideo(id, attrs, req = null) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");
  
  const exprNames = {}; const exprVals = {}; const sets = [];
  Object.entries(attrs).forEach(([k,v]) => { exprNames["#"+k]=k; exprVals[":"+k]=v; sets.push(`#${k} = :${k}`); });
  await doc.send(new UpdateCommand({ 
    TableName, 
    Key: { 
      "qut-username": qutUsername,
      "id": id 
    }, 
    UpdateExpression: `SET ${sets.join(", ")}`, 
    ExpressionAttributeNames: exprNames, 
    ExpressionAttributeValues: exprVals 
  }));
}

async function deleteVideo(id, req = null) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  // 统一使用固定的学号邮箱，与 createVideo 保持一致
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  await doc.send(new DeleteCommand({ 
    TableName, 
    Key: { 
      "qut-username": qutUsername,
      "id": id 
    } 
  }));
}

async function createScreenshot(item, req = null) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  
  // 强制使用固定的学号邮箱，不依赖 req.user
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  const screenshotItem = {
    ...item,
    "qut-username": qutUsername
  };
  
  await doc.send(new PutCommand({ TableName, Item: screenshotItem }));
  return screenshotItem;
}

async function getScreenshot(id, req = null) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  // 统一使用固定的学号邮箱，与 createScreenshot 保持一致
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  const r = await doc.send(new GetCommand({ 
    TableName, 
    Key: { 
      "qut-username": qutUsername,
      "id": id 
    } 
  }));
  return r.Item || null;
}

async function listScreenshotsByOwner(owner, req = null) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  
  if (owner) {
    // 普通用户：使用 Scan + FilterExpression 查询特定用户的所有截图
    const r = await doc.send(new ScanCommand({
      TableName,
      FilterExpression: "#pk = :username",
      ExpressionAttributeNames: { 
        "#pk": "qut-username"
      },
      ExpressionAttributeValues: { 
        ":username": owner
      }
    }));
    return r.Items || [];
  } else {
    // Admin 用户：直接 Scan 所有截图
    const r = await doc.send(new ScanCommand({ TableName }));
    return r.Items || [];
  }
}

async function updateScreenshot(id, attrs, req = null) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  const qutUsername = req ? getCurrentUser(req) : (process.env.QUT_USERNAME || "n11866632@qut.edu.au");
  
  const exprNames = {}; const exprVals = {}; const sets = [];
  Object.entries(attrs).forEach(([k,v]) => { exprNames["#"+k]=k; exprVals[":"+k]=v; sets.push(`#${k} = :${k}`); });
  await doc.send(new UpdateCommand({ 
    TableName, 
    Key: { 
      "qut-username": qutUsername,
      "id": id 
    }, 
    UpdateExpression: `SET ${sets.join(", ")}`, 
    ExpressionAttributeNames: exprNames, 
    ExpressionAttributeValues: exprVals 
  }));
}

async function deleteScreenshot(id, req = null) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  // 统一使用固定的学号邮箱，与 createScreenshot 保持一致
  const qutUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  await doc.send(new DeleteCommand({ 
    TableName, 
    Key: { 
      "qut-username": qutUsername,
      "id": id 
    } 
  }));
}

module.exports.media = {
  createVideo, getVideo, listVideosByOwner, updateVideo, deleteVideo,
  createScreenshot, getScreenshot, listScreenshotsByOwner, updateScreenshot, deleteScreenshot
};