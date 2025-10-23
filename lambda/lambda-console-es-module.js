// ES Module version - Load Test Lambda for Video Processor Auto-scaling
// Copy this code into AWS Lambda Console

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { ECSClient, DescribeServicesCommand } from '@aws-sdk/client-ecs';

// Initialize AWS clients
const sqsClient = new SQSClient({ region: 'ap-southeast-2' });
const ecsClient = new ECSClient({ region: 'ap-southeast-2' });

// Your actual configuration - UPDATE THE QUEUE URL BELOW
const CONFIG = {
    // TODO: Replace this with your actual SQS queue URL from AWS SQS console
    VIDEO_TRANSCODE_QUEUE_URL: 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11851287-video-transcode',
    ECS_CLUSTER_NAME: 'game-media-cluster',
    ECS_SERVICE_NAME: 'game-media-video-processor-service-4aurf5h4',
    INITIAL_MESSAGE_BATCH: 30,        // Increased from 15
    ADDITIONAL_MESSAGE_BATCH: 20,     // Increased from 10
    MONITORING_DURATION_MINUTES: 10,  // Increased from 8
    BATCH_INTERVAL_SECONDS: 15        // Reduced from 30 (send more frequently)
};

function generateVideoTranscodingTasks(count) {
    const tasks = [];
    const timestamp = Date.now();
    
    for (let i = 0; i < count; i++) {
        const taskId = `load-test-video-${timestamp}-${i}`;
        const videoId = `test-video-${timestamp}-${i}`;
        
        tasks.push({
            taskId: taskId,
            type: "transcode",
            targetType: "video",
            targetId: videoId,
            videoId: videoId,
            owner: "load-test-user",
            status: "queued",
            params: { multi: ["720p", "480p", "360p"] },
            createdAt: Date.now(),
            filename: `uploads/videos/1760081317795_Nikki.mp4`, // Use real video file that exists
            queueName: "VIDEO_TRANSCODE",
            userEmail: "n11866632@qut.edu.au"
        });
    }
    return tasks;
}

async function sendMessagesToQueue(queueUrl, messages) {
    const promises = messages.map(message => {
        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(message),
            MessageAttributes: {
                messageType: { DataType: "String", StringValue: "transcode" },
                timestamp: { DataType: "String", StringValue: new Date().toISOString() },
                loadTest: { DataType: "String", StringValue: "true" }
            }
        });
        return sqsClient.send(command);
    });
    
    const results = await Promise.all(promises);
    console.log(`Sent ${results.length} messages to queue`);
    return results;
}

async function getServiceTaskCount(clusterName, serviceName) {
    try {
        const command = new DescribeServicesCommand({
            cluster: clusterName,
            services: [serviceName]
        });
        
        const result = await ecsClient.send(command);
        
        if (result.services.length > 0) {
            const service = result.services[0];
            return {
                runningCount: service.runningCount,
                desiredCount: service.desiredCount,
                pendingCount: service.pendingCount,
                status: service.status
            };
        }
        return { runningCount: 0, desiredCount: 0, pendingCount: 0, status: 'UNKNOWN' };
    } catch (error) {
        console.error(`⚠️  ECS monitoring failed (permission issue):`, error.message);
        console.log('📊 You can monitor scaling manually in ECS console');
        return { runningCount: 1, desiredCount: 1, pendingCount: 0, status: 'MONITORING_DISABLED' };
    }
}

export const handler = async (event) => {
    console.log('=== STARTING ES MODULE LOAD TEST ===');
    console.log('⚠️  NOTE: Update the SQS queue URL in CONFIG before running!');
    
    const startTime = new Date();
    const testId = `load-test-${Date.now()}`;
    
    try {
        // Phase 1: Test Queue Connection First
        console.log('\n=== PHASE 1: TESTING QUEUE CONNECTION ===');
        console.log(`Queue URL: ${CONFIG.VIDEO_TRANSCODE_QUEUE_URL}`);
        
        // Test with a single message first
        const testTasks = generateVideoTranscodingTasks(1);
        await sendMessagesToQueue(CONFIG.VIDEO_TRANSCODE_QUEUE_URL, testTasks);
        console.log('✅ Queue connection successful!');
        
        // Phase 2: Baseline Check
        console.log('\n=== PHASE 2: BASELINE CHECK ===');
        const initialTasks = await getServiceTaskCount(CONFIG.ECS_CLUSTER_NAME, CONFIG.ECS_SERVICE_NAME);
        console.log(`Initial: Running=${initialTasks.runningCount}, Desired=${initialTasks.desiredCount}`);
        
        // Phase 3: Generate Load
        console.log('\n=== PHASE 3: GENERATING LOAD ===');
        const initialTasksGenerated = generateVideoTranscodingTasks(CONFIG.INITIAL_MESSAGE_BATCH);
        await sendMessagesToQueue(CONFIG.VIDEO_TRANSCODE_QUEUE_URL, initialTasksGenerated);
        console.log(`✅ Sent ${CONFIG.INITIAL_MESSAGE_BATCH} initial video transcoding tasks`);
        
        // Phase 4: Monitor Scaling
        console.log('\n=== PHASE 4: MONITORING SCALING ===');
        let maxTasksReached = initialTasks.runningCount;
        let scalingEvents = [];
        const monitoringDurationMs = CONFIG.MONITORING_DURATION_MINUTES * 60 * 1000;
        const batchIntervalMs = CONFIG.BATCH_INTERVAL_SECONDS * 1000;
        
        const monitoringStartTime = Date.now();
        let batchCount = 0;
        
        while (Date.now() - monitoringStartTime < monitoringDurationMs) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
            
            const currentTasks = await getServiceTaskCount(CONFIG.ECS_CLUSTER_NAME, CONFIG.ECS_SERVICE_NAME);
            const elapsedMinutes = Math.floor((Date.now() - monitoringStartTime) / 60000);
            
            console.log(`[${elapsedMinutes}m] Running=${currentTasks.runningCount}, Desired=${currentTasks.desiredCount}`);
            
            maxTasksReached = Math.max(maxTasksReached, currentTasks.runningCount);
            
            if (currentTasks.desiredCount > initialTasks.desiredCount) {
                scalingEvents.push({
                    timestamp: new Date().toISOString(),
                    runningCount: currentTasks.runningCount,
                    desiredCount: currentTasks.desiredCount,
                    elapsedMinutes: elapsedMinutes
                });
            }
            
            // Send additional load every 30 seconds
            if (Date.now() - monitoringStartTime > batchCount * batchIntervalMs + batchIntervalMs) {
                batchCount++;
                const additionalTasks = generateVideoTranscodingTasks(CONFIG.ADDITIONAL_MESSAGE_BATCH);
                await sendMessagesToQueue(CONFIG.VIDEO_TRANSCODE_QUEUE_URL, additionalTasks);
                console.log(`[${elapsedMinutes}m] Sent additional ${CONFIG.ADDITIONAL_MESSAGE_BATCH} tasks`);
            }
        }
        
        // Phase 5: Final Assessment
        console.log('\n=== PHASE 5: FINAL ASSESSMENT ===');
        const finalTasks = await getServiceTaskCount(CONFIG.ECS_CLUSTER_NAME, CONFIG.ECS_SERVICE_NAME);
        
        const results = {
            testId: testId,
            startTime: startTime.toISOString(),
            endTime: new Date().toISOString(),
            videoProcessor: {
                initial: initialTasks,
                final: finalTasks,
                maxReached: maxTasksReached,
                scaledUp: maxTasksReached > initialTasks.runningCount,
                scalingEvents: scalingEvents
            },
            loadTest: {
                totalTasksSent: 1 + CONFIG.INITIAL_MESSAGE_BATCH + (batchCount * CONFIG.ADDITIONAL_MESSAGE_BATCH), // +1 for test message
                targetCpuUtilization: 70
            }
        };
        
        console.log('\n=== LOAD TEST RESULTS ===');
        console.log(JSON.stringify(results, null, 2));
        
        const requirementsMet = {
            autoScalingTriggered: results.videoProcessor.scaledUp,
            scaledToTargetInstances: maxTasksReached >= 3,
            scalingEventsRecorded: scalingEvents.length > 0
        };
        
        console.log('\n=== REQUIREMENTS CHECK ===');
        console.log(`Auto-scaling Triggered: ${requirementsMet.autoScalingTriggered ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Scaled to 3+ instances: ${requirementsMet.scaledToTargetInstances ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Scaling Events Recorded: ${requirementsMet.scalingEventsRecorded ? '✅ PASS' : '❌ FAIL'}`);
        
        const overallSuccess = Object.values(requirementsMet).every(req => req === true);
        console.log(`\nOverall Test Result: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        console.log('\n=== NEXT STEPS ===');
        console.log('1. ✅ Load has been sent to SQS queue');
        console.log('2. 📊 Check your ECS console to monitor auto-scaling');
        console.log('3. 📈 Watch CloudWatch metrics for CPU utilization');
        console.log('4. 🎯 Your video processor should scale from 1 to 3 instances');
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Load test completed successfully',
                testId: testId,
                results: results,
                requirementsMet: requirementsMet,
                overallSuccess: overallSuccess
            })
        };
        
    } catch (error) {
        console.error('❌ Load test failed:', error);
        
        // Provide helpful error messages
        let errorMessage = error.message;
        if (error.name === 'QueueDoesNotExist') {
            errorMessage = `SQS Queue not found. Please check the queue URL: ${CONFIG.VIDEO_TRANSCODE_QUEUE_URL}`;
            console.log('💡 TIP: Go to AWS SQS console and copy the correct queue URL');
        }
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Load test failed',
                error: errorMessage,
                testId: testId,
                troubleshooting: {
                    queueUrl: CONFIG.VIDEO_TRANSCODE_QUEUE_URL,
                    suggestion: 'Check AWS SQS console for correct queue URL'
                }
            })
        };
    }
};
