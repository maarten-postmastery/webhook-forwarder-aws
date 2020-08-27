# Webhook Forwarder

Does your webhook provider support one endpoint, and you need multiple? Use this guide to deploy a webhook forwarder on Amazon Web Services (AWS) with minimal effort. The forwarder works as a pub/sub system, data from the webhook provider is duplicated to multiple endpoints.

The forwarder is implemented with AWS services and minimal code. See the schema below.

    webhook provider -> AWS API Gateway -> AWS Lambda -> AWS SNS -> webhook endpoints

The API Gateway service is used to expose a lambda function over HTTP. The Lambda service is used to run a Node.js function which publishes the payload to a SNS topic. The SNS service is used to duplicate the payload to multiple subscribers.

Amazon SNS can handle messages up to 256KB. Larger messages will be split and sent as multiple messages. For JSON encoded messages this can be a problem. We recommend to use [newline delimited JSON](ndjson.org) and split larger messages at line boundaries.

Amazon SNS requires HTTP(S) endpoints to confirm subscription by calling a URL sent in a subscription confirmation request. See [this guide](https://docs.aws.amazon.com/sns/latest/dg/sns-http-https-endpoint-as-subscriber.html#SendMessageToHttp.prepare) on how to prepare your endpoint. After confirmation the webhook data will be forwarded to the endpoint as raw messages, exactly as sent by the webhook provider.

If you are unable to handle the subscription confirmation request you can use a Lambda function as subscriber which confirms the request and acts as a proxy for the HTTP(S) endpoint.

To protect against data loss when an endpoint is down for longer periods you can consider using an SQS queue as subscriber and a Lambda function to read from the queue and call the endpoint.

## Deployment

### SNS

Open the [SNS console](https://console.aws.amazon.com/sns/v3/home).

Create a SNS topic.

1. Go to Topics.
2. Click Create Topic.
3. Enter a name for the topic.
4. Review the Delivery retry policy settings.
5. Review the Delivery status logging settings.
6. Click Create topic.
7. Note the ARN of the topic.

Create a SNS subscription for each endpoint.

1. Go to Subscriptions. Click Create subscription.
2. Select the topic ARN created above.
3. For Protocol select HTTPS.
4. For endpoint enter the URL of your first endpoint.
5. Click Enable raw message delivery.
6. Click Create subscription.

See [Using Amazon SNS for system-to-system messaging with an HTTP/s endpoint as a subscriber](https://docs.aws.amazon.com/sns/latest/dg/sns-http-https-endpoint-as-subscriber.html) for more information.

### Lambda

Open the [AWS Lambda console](https://console.aws.amazon.com/lambda/home).

In the toolbar, select a region close to the webhook provider or the webhook consumers.

Create a Lambda function.

1. Choose Create a function.
2. Select Author from scratch.
3. For Function name, enter webhook-endpoint or some other name.
4. For Runtime select Node.js 12.x
5. Copy the code from endpoint/index.js in this repository.
6. For Permissions select Create a new role with basic Lambda permissions.
7. Click Create function.

Set environment variable.

1. Click Manage environment variables.
2. Click Add environment variable.
3. For Key enter TOPIC_ARN. 
4. For Value enter the topic ARN created above.
5. Click Save.

Create HTTPS endpoint for function.

1. In the designer click + Add trigger.
2. Select API Gateway.
3. For API type select REST API.
4. For Security select Open or API key, depending on the capabilities of the webhook provider.
5. Click Add.

The Lambda function is called with the [proxy integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html) feature enabled.

You can click on the API name to open the API Gateway console. 

You can open Details under the API Gateway entry to view the API endpoint URL.

Allow Lambda execution role to publish to SNS topics.

1. Select the Permission tab.
2. Click the role name to open it in IAM.
3. Click + Add inline policy.
4. In the JSON tab specify:

    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "sns:Publish",
                "Resource": "arn:aws:sns:*:*:*"
            }
        ]
    }

See also [Give users permissions to publish to the topic ](https://docs.aws.amazon.com/sns/latest/dg/sns-http-https-endpoint-as-subscriber.html#SendMessageToHttp.iam.permissions).

### Testing

Use cURL to submit a test message. Use the endpoint URL shown in the function properties. Below is an example of a Sendgrid webhook request:

    curl -X POST -i -H "Content-Type: application/json" -d '[{"email":"john.doe@sendgrid.com","timestamp":1588777534,"smtp-id":"<4FB4041F.6080505@sendgrid.com>","event":"processed"},{"email":"john.doe@sendgrid.com","timestamp":1588777600,"category":"newuser","event":"click","url":"https://sendgrid.com"},{"email":"john.doe@sendgrid.com","timestamp":1588777692,"smtp-id":"<20120525181309.C1A9B40405B3@Example-Mac.local>","event":"processed"}]' https://xxxxxx.execute-api.eu-west-1.amazonaws.com/default/webhook-endpoint

