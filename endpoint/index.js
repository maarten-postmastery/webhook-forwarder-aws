'use strict';

var AWS = require('aws-sdk');  
var topicArn = process.env.TOPIC_ARN;

// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
exports.handler = async (event) => {
    //console.log("EVENT: \n" + JSON.stringify(event, null, 2));
    // https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
    if (!event['body']) {
        // not called as proxy or body is empty 
        return {"statusCode": 400, "body": "Empty body"};
    }
    let size = event.body.length;
    if (size > 262144) {
        // messages larger than 256KB will be cut on word boundaries, breaking JSON syntax
        console.warn("Body larger than 256KB: " + size);
    }
    
    // https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/sns-examples-publishing-messages.html#sns-examples-publishing-text-messages
    let sns = new AWS.SNS();
    let data = await sns.publish({
        Message: event.body,
        TopicArn: topicArn
    }).promise();
    // https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format
    return {"statusCode": 200, "body": JSON.stringify(data)};
};
