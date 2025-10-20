const AWS = require('aws-sdk');
const sqs = new AWS.SQS();

exports.handler = async (event) => {
    console.log('S3 Event received:', JSON.stringify(event, null, 2));
    
    try {
        for (const record of event.Records) {
            if (record.eventName.startsWith('ObjectCreated')) {
                const bucket = record.s3.bucket.name;
                const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
                
                console.log(`Processing file: ${key} from bucket: ${bucket}`);
                
                // 根据文件类型发送到不同队列
                if (key.match(/\.(mp4|avi|mov|mkv|wmv|flv|webm)$/i)) {
                    // 视频文件 - 发送到视频转码队列
                    const messageBody = {
                        type: 's3-event',
                        bucket: bucket,
                        key: key,
                        filename: key.split('/').pop(),
                        timestamp: Date.now(),
                        source: 's3-event'
                    };
                    
                    await sqs.sendMessage({
                        QueueUrl: process.env.VIDEO_TRANSCODE_QUEUE_URL,
                        MessageBody: JSON.stringify(messageBody)
                    }).promise();
                    
                    console.log(`Video file ${key} sent to video transcode queue`);
                    
                } else if (key.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i)) {
                    // 图片文件 - 发送到图片处理队列
                    const messageBody = {
                        type: 's3-event',
                        bucket: bucket,
                        key: key,
                        filename: key.split('/').pop(),
                        timestamp: Date.now(),
                        source: 's3-event'
                    };
                    
                    await sqs.sendMessage({
                        QueueUrl: process.env.IMAGE_PROCESS_QUEUE_URL,
                        MessageBody: JSON.stringify(messageBody)
                    }).promise();
                    
                    console.log(`Image file ${key} sent to image process queue`);
                }
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'S3 events processed successfully',
                processedRecords: event.Records.length
            })
        };
        
    } catch (error) {
        console.error('Error processing S3 event:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to process S3 event',
                details: error.message
            })
        };
    }
};


