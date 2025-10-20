const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();
const applicationAutoScaling = new AWS.ApplicationAutoScaling();

exports.handler = async (event) => {
    console.log('Custom scaling metric handler triggered');
    
    try {
        // 获取SQS队列深度
        const sqs = new AWS.SQS();
        const videoQueueUrl = process.env.VIDEO_TRANSCODE_QUEUE_URL;
        const imageQueueUrl = process.env.IMAGE_PROCESS_QUEUE_URL;
        
        // 获取视频队列深度
        const videoAttributes = await sqs.getQueueAttributes({
            QueueUrl: videoQueueUrl,
            AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
        }).promise();
        
        const videoQueueDepth = parseInt(videoAttributes.Attributes.ApproximateNumberOfMessages || '0');
        const videoInFlight = parseInt(videoAttributes.Attributes.ApproximateNumberOfMessagesNotVisible || '0');
        
        // 获取图片队列深度
        const imageAttributes = await sqs.getQueueAttributes({
            QueueUrl: imageQueueUrl,
            AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
        }).promise();
        
        const imageQueueDepth = parseInt(imageAttributes.Attributes.ApproximateNumberOfMessages || '0');
        const imageInFlight = parseInt(imageAttributes.Attributes.ApproximateNumberOfMessagesNotVisible || '0');
        
        const totalQueueDepth = videoQueueDepth + imageQueueDepth;
        const totalInFlight = videoInFlight + imageInFlight;
        
        console.log(`Queue depths - Video: ${videoQueueDepth}, Image: ${imageQueueDepth}, Total: ${totalQueueDepth}`);
        console.log(`In-flight messages - Video: ${videoInFlight}, Image: ${imageInFlight}, Total: ${totalInFlight}`);
        
        // 发布自定义指标到CloudWatch
        await cloudwatch.putMetricData({
            Namespace: 'GameMedia/Custom',
            MetricData: [
                {
                    MetricName: 'SQSQueueDepth',
                    Value: totalQueueDepth,
                    Unit: 'Count',
                    Dimensions: [
                        {
                            Name: 'QueueType',
                            Value: 'Total'
                        }
                    ]
                },
                {
                    MetricName: 'SQSInFlightMessages',
                    Value: totalInFlight,
                    Unit: 'Count',
                    Dimensions: [
                        {
                            Name: 'QueueType',
                            Value: 'Total'
                        }
                    ]
                },
                {
                    MetricName: 'VideoQueueDepth',
                    Value: videoQueueDepth,
                    Unit: 'Count',
                    Dimensions: [
                        {
                            Name: 'QueueType',
                            Value: 'Video'
                        }
                    ]
                },
                {
                    MetricName: 'ImageQueueDepth',
                    Value: imageQueueDepth,
                    Unit: 'Count',
                    Dimensions: [
                        {
                            Name: 'QueueType',
                            Value: 'Image'
                        }
                    ]
                }
            ]
        }).promise();
        
        console.log('Custom metrics published to CloudWatch');
        
        // 根据队列深度计算目标容量
        let targetCapacity = 1;
        if (totalQueueDepth > 15) {
            targetCapacity = 3;
        } else if (totalQueueDepth > 8) {
            targetCapacity = 2;
        }
        
        console.log(`Calculated target capacity: ${targetCapacity}`);
        
        // 发布目标容量指标
        await cloudwatch.putMetricData({
            Namespace: 'GameMedia/Custom',
            MetricData: [
                {
                    MetricName: 'TargetCapacity',
                    Value: targetCapacity,
                    Unit: 'Count',
                    Dimensions: [
                        {
                            Name: 'Service',
                            Value: 'VideoProcessor'
                        }
                    ]
                }
            ]
        }).promise();
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Custom scaling metrics updated',
                queueDepth: totalQueueDepth,
                targetCapacity: targetCapacity,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Error in custom scaling handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to update custom scaling metrics',
                details: error.message
            })
        };
    }
};


