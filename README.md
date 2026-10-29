# Company-RAG-Chatbot
A retrieval-augmented generation (RAG) chatbot for a fictional company, built on Amazon Bedrock with Claude. Uses AWS Lambda for the backend, IAM for secure access, and CloudShell for setup and deployment.
# Company RAG Chatbot with Amazon Bedrock and Claude

A retrieval-augmented generation (RAG) chatbot for Northwind Outfitters, a
fictional company. It answers questions using the company's documents stored in
an Amazon Bedrock Knowledge Base, and runs serverless on AWS with Claude.

## Architecture

```
User question
     |
     v
AWS Lambda (Node.js)
     |--(1) Retrieve relevant chunks--> Bedrock Knowledge Base (S3 documents)
     |--(2) Question + context -------> Amazon Bedrock (Claude)
     v
Grounded answer returned to the user
```

## Tech Stack

| Service | Role |
|---|---|
| Amazon Bedrock Knowledge Bases | Stores and retrieves company document chunks |
| Amazon Bedrock + Claude | Generates answers from retrieved context |
| AWS Lambda (Node.js, ES modules) | Serverless backend |
| AWS IAM | Least-privilege roles and policies |
| AWS CloudShell | Setup and deployment |

## Project Structure

```
rag-chat/
├── index.js           # Lambda handler
├── package.json       # Dependencies (ES modules)
└── package-lock.json
```

## Prerequisites

- AWS account with permission to create IAM roles and Lambda functions
- Claude model access enabled in the Bedrock console
- A Bedrock Knowledge Base created from your company documents in S3
- Node.js 20+ runtime available in Lambda

## Setup

### 1. Clone and install

```bash
git clone https://github.com/KaelemTuray/Company-RAG-Chatbot.git
cd Company-RAG-Chatbot/rag-chat
npm install
```

### 2. Configure environment variables

Set these on the Lambda function (never commit them):

| Variable | Description |
|---|---|
| `KNOWLEDGE_BASE_ID` | Your Bedrock Knowledge Base ID |
| `MODEL_ID` | Claude model or inference profile ID |
| `AWS_REGION` | Region (Lambda sets this automatically) |

*(Match these names to what `index.js` actually reads.)*

### 3. IAM permissions

The Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:Retrieve"],
      "Resource": "arn:aws:bedrock:[REGION]:[ACCOUNT_ID]:knowledge-base/[KB_ID]"
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "*"
    }
  ]
}
```

Plus the AWS managed `AWSLambdaBasicExecutionRole` for logging. Tighten the
`InvokeModel` resource to your specific model or inference profile ARN.

### 4. Package and deploy

```bash
cd rag-chat
zip -r ../function.zip .
cd ..

aws lambda create-function \
  --function-name company-rag-chatbot \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::[ACCOUNT_ID]:role/[ROLE_NAME] \
  --zip-file fileb://function.zip \
  --timeout 30
```

To update later, use `aws lambda update-function-code` with the new zip.

### 5. Test

```bash
aws lambda invoke \
  --function-name company-rag-chatbot \
  --cli-binary-format raw-in-base64-out \
  --payload '{"question": "What is the vacation policy?"}' \
  response.json

cat response.json
```

## Security

- IAM roles follow least privilege
- No credentials stored in the repo
- `node_modules` and secrets are excluded via `.gitignore`

## Cleanup

```bash
aws lambda delete-function --function-name company-rag-chatbot
```

Then delete the IAM role, Knowledge Base, S3 bucket, and vector store to avoid
ongoing charges (vector stores like OpenSearch Serverless can be costly).

## Disclaimer

[Company Name] is fictional. All sample data is made up.
