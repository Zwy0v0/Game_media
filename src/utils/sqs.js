const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { region } = require("./config");

const sqs = new SQSClient({ region });

// SQS队列URL配置
const QUEUE_URLS = {
  VIDEO_TRANSCODE: process.env.VIDEO_TRANSCODE_QUEUE_URL || "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11851287-video-transcode",
  IMAGE_PROCESS: process.env.IMAGE_PROCESS_QUEUE_URL || "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11851287-image-process",
  DLQ: process.env.DLQ_URL || "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11851287-dlq"
};

/**
 * 发送消息到SQS队列
 */
exports.sendMessage = async (queueName, messageBody, messageAttributes = {}) => {
  try {
    const queueUrl = QUEUE_URLS[queueName];
    if (!queueUrl) {
      throw new Error(`Queue URL not found for ${queueName}`);
    }

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageAttributes: {
        messageType: {
          DataType: "String",
          StringValue: messageBody.type || "unknown"
        },
        timestamp: {
          DataType: "String", 
          StringValue: new Date().toISOString()
        },
        ...messageAttributes
      }
    });

    const result = await sqs.send(command);
    console.log(`Message sent to ${queueName}:`, result.MessageId);
    return result;
  } catch (error) {
    console.error(`Error sending message to ${queueName}:`, error);
    throw error;
  }
};

/**
 * 接收消息从SQS队列
 */
exports.receiveMessage = async (queueName, maxMessages = 1, waitTimeSeconds = 20) => {
  try {
    const queueUrl = QUEUE_URLS[queueName];
    if (!queueUrl) {
      throw new Error(`Queue URL not found for ${queueName}`);
    }

    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds,
      MessageAttributeNames: ["All"],
      AttributeNames: ["All"]
    });

    const result = await sqs.send(command);
    return result.Messages || [];
  } catch (error) {
    console.error(`Error receiving message from ${queueName}:`, error);
    throw error;
  }
};

/**
 * 删除已处理的消息
 */
exports.deleteMessage = async (queueName, receiptHandle) => {
  try {
    const queueUrl = QUEUE_URLS[queueName];
    if (!queueUrl) {
      throw new Error(`Queue URL not found for ${queueName}`);
    }

    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    });

    await sqs.send(command);
    console.log("Message deleted successfully");
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
};

/**
 * 发送失败消息到DLQ
 */
exports.sendToDLQ = async (originalMessage, error) => {
  try {
    const dlqMessage = {
      ...originalMessage,
      originalQueue: originalMessage.queueName,
      error: error.message || String(error),
      failedAt: new Date().toISOString(),
      retryCount: (originalMessage.retryCount || 0) + 1
    };

    await exports.sendMessage("DLQ", dlqMessage, {
      originalQueue: {
        DataType: "String",
        StringValue: originalMessage.queueName || "unknown"
      },
      error: {
        DataType: "String",
        StringValue: error.message || String(error)
      }
    });
  } catch (dlqError) {
    console.error("Failed to send message to DLQ:", dlqError);
  }
};
