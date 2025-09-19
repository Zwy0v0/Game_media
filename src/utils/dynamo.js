const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getParameter, region } = require("./config");

const ddb = new DynamoDBClient({ region });
const doc = DynamoDBDocumentClient.from(ddb);

async function getTableName() {
  return process.env.DDB_TASK_TABLE || await getParameter(process.env.PARAM_DDB_TASK_TABLE || "/game-media/prod/taskTable", false).catch(() => null);
}

async function putTaskStatus(task) {
  const TableName = await getTableName();
  if (!TableName) return;
  await doc.send(new PutCommand({ TableName, Item: task }));
}

async function getTaskStatus(taskId) {
  const TableName = await getTableName();
  if (!TableName) return null;
  const res = await doc.send(new GetCommand({ TableName, Key: { taskId } }));
  return res.Item || null;
}

async function updateTaskStatus(taskId, attrs) {
  const TableName = await getTableName();
  if (!TableName) return;
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
    Key: { taskId },
    UpdateExpression: `SET ${sets.join(", ")}`,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprVals
  }));
}

module.exports = { putTaskStatus, getTaskStatus, updateTaskStatus };

// ---- Media tables helpers ----
async function getVideosTableName() {
  return process.env.DDB_VIDEOS_TABLE || await getParameter(process.env.PARAM_DDB_VIDEOS_TABLE || "/game-media/prod/videosTable", false).catch(() => null);
}
async function getScreenshotsTableName() {
  return process.env.DDB_SCREENSHOTS_TABLE || await getParameter(process.env.PARAM_DDB_SCREENSHOTS_TABLE || "/game-media/prod/screenshotsTable", false).catch(() => null);
}

async function createVideo(item) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  await doc.send(new PutCommand({ TableName, Item: item }));
  return item;
}
async function getVideo(id) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  const r = await doc.send(new GetCommand({ TableName, Key: { id } }));
  return r.Item || null;
}
async function listVideosByOwner(owner) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  // If no GSI, fall back to Scan with filter (acceptable for assignment scale)
  const r = await doc.send(new ScanCommand({ TableName }));
  const items = (r.Items || []).filter(x => !owner || x.owner === owner);
  return items;
}
async function updateVideo(id, attrs) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  const exprNames = {}; const exprVals = {}; const sets = [];
  Object.entries(attrs).forEach(([k,v]) => { exprNames["#"+k]=k; exprVals[":"+k]=v; sets.push(`#${k} = :${k}`); });
  await doc.send(new UpdateCommand({ TableName, Key: { id }, UpdateExpression: `SET ${sets.join(", ")}`, ExpressionAttributeNames: exprNames, ExpressionAttributeValues: exprVals }));
}
async function deleteVideo(id) {
  const TableName = await getVideosTableName(); if (!TableName) throw new Error("videos table not set");
  await doc.send(new DeleteCommand({ TableName, Key: { id } }));
}

async function createScreenshot(item) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  await doc.send(new PutCommand({ TableName, Item: item }));
  return item;
}
async function getScreenshot(id) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  const r = await doc.send(new GetCommand({ TableName, Key: { id } }));
  return r.Item || null;
}
async function listScreenshotsByOwner(owner) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  const r = await doc.send(new ScanCommand({ TableName }));
  const items = (r.Items || []).filter(x => !owner || x.owner === owner);
  return items;
}
async function updateScreenshot(id, attrs) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  const exprNames = {}; const exprVals = {}; const sets = [];
  Object.entries(attrs).forEach(([k,v]) => { exprNames["#"+k]=k; exprVals[":"+k]=v; sets.push(`#${k} = :${k}`); });
  await doc.send(new UpdateCommand({ TableName, Key: { id }, UpdateExpression: `SET ${sets.join(", ")}`, ExpressionAttributeNames: exprNames, ExpressionAttributeValues: exprVals }));
}
async function deleteScreenshot(id) {
  const TableName = await getScreenshotsTableName(); if (!TableName) throw new Error("screenshots table not set");
  await doc.send(new DeleteCommand({ TableName, Key: { id } }));
}

module.exports.media = {
  createVideo, getVideo, listVideosByOwner, updateVideo, deleteVideo,
  createScreenshot, getScreenshot, listScreenshotsByOwner, updateScreenshot, deleteScreenshot
};


