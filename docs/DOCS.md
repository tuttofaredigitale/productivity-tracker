# Productivity Tracker - Complete Technical Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [AWS Implementation (Focus)](#4-aws-implementation-focus)
5. [Code Structure](#5-code-structure)
6. [Data Flow](#6-data-flow)
7. [Configuration and Deployment](#7-configuration-and-deployment)
8. [Security](#8-security)
9. [Estimated AWS Costs](#9-estimated-aws-costs)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Project Overview

### What is Productivity Tracker

A lightweight desktop application to track time spent on different projects, featuring:

- **Pomodoro Timer** configurable (25/50 min work, 5/15 min break, free mode)
- **Project Management** with custom colors
- **Analytics** with charts (hourly, weekly, project distribution)
- **Cloud Sync** to AWS S3 for backup and multi-device support
- **AI Insights** with multi-provider support (Anthropic, OpenAI, Groq, Ollama)
- **Focus Music** streaming radio stations for concentration

### Why Tauri

| Feature        | Tauri             | Electron          |
| -------------- | ----------------- | ----------------- |
| RAM usage      | ~30-50 MB         | ~300+ MB          |
| Installer size | ~5-10 MB          | ~150+ MB          |
| Rendering      | Native OS WebView | Embedded Chromium |
| Backend        | Rust              | Node.js           |

Tauri uses the WebView already present in the operating system (WebView2 on Windows, WebKit on macOS/Linux), so it doesn't include a full browser in the application.

---

## 2. Architecture

### General Schema

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCTIVITY TRACKER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    TAURI APP (Desktop)                        │    │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐   │    │
│  │  │   Rust Backend   │  │        Frontend (WebView)        │   │    │
│  │  │   (~10 lines)    │  │   HTML + CSS + JavaScript       │   │    │
│  │  │                  │  │                                  │   │    │
│  │  │  • Window mgmt   │  │  • Timer logic                  │   │    │
│  │  │  • FS access     │  │  • Charts (Chart.js)            │   │    │
│  │  │  • HTTP client   │  │  • State management             │   │    │
│  │  │  • Notifications │  │  • UI rendering                 │   │    │
│  │  └─────────────────┘  └─────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                    │                                  │
│                                    │ HTTPS                            │
│                                    ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                         AWS CLOUD                             │    │
│  │                                                               │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │    │
│  │  │ API Gateway │───▶│   Lambda    │───▶│       S3        │  │    │
│  │  │  (HTTP API) │    │  (Node.js)  │    │  (JSON logs)    │  │    │
│  │  │             │    │             │    │                 │  │    │
│  │  │ /prod/sync  │    │ • PUT data  │    │ daily-logs/     │  │    │
│  │  │ GET & POST  │    │ • GET data  │    │ 2025-12-28.json │  │    │
│  │  │             │    │ • GET range │    │ 2025-12-27.json │  │    │
│  │  └─────────────┘    └─────────────┘    └─────────────────┘  │    │
│  │                                                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      AI PROVIDERS                             │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │    │
│  │  │ Anthropic │ │  OpenAI   │ │   Groq    │ │  Ollama   │    │    │
│  │  │  (Claude) │ │  (GPT-4)  │ │  (Llama)  │ │  (Local)  │    │    │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### AWS Request Flow

```
┌──────────┐     POST /sync      ┌─────────────┐     PutObject     ┌────────┐
│  App     │ ──────────────────▶ │ API Gateway │ ────────────────▶ │ Lambda │
│ (Tauri)  │                     │             │                   │        │
└──────────┘                     └─────────────┘                   └────┬───┘
                                                                        │
     ┌──────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS LAMBDA                                  │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  1. Receives event from API Gateway                             │    │
│  │  2. Parses JSON body                                            │    │
│  │  3. Constructs S3 key: daily-logs/YYYY-MM-DD.json              │    │
│  │  4. Calls S3 PutObject                                          │    │
│  │  5. Returns JSON response                                       │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ S3 API
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              S3 BUCKET                                   │
│  your-bucket-name/                                                      │
│  ├── daily-logs/                                                        │
│  │   ├── 2025-12-27.json                                               │
│  │   ├── 2025-12-28.json                                               │
│  │   └── ...                                                            │
│  └── (versioning enabled for recovery)                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend

| Technology | Version | Purpose                         |
| ---------- | ------- | ------------------------------- |
| HTML5      | -       | UI Structure                    |
| CSS3       | -       | Styles (industrial-tech design) |
| JavaScript | ES2020+ | Application logic               |
| Chart.js   | 4.4.1   | Charts (via CDN)                |

### Desktop Runtime

| Technology      | Version      | Purpose                  |
| --------------- | ------------ | ------------------------ |
| Tauri           | 2.x          | Desktop framework        |
| Rust            | 2021 edition | Native backend (minimal) |
| WebView2/WebKit | Native OS    | HTML rendering           |

### AWS Services

| Service     | Type       | Purpose                 |
| ----------- | ---------- | ----------------------- |
| S3          | Storage    | JSON log persistence    |
| Lambda      | Compute    | API business logic      |
| API Gateway | Network    | Public HTTP endpoint    |
| IAM         | Security   | Roles and permissions   |
| CloudWatch  | Monitoring | Lambda logs (automatic) |

### AI Providers (optional)

| Provider  | Models                   | Notes                |
| --------- | ------------------------ | -------------------- |
| Anthropic | Claude Sonnet/Opus/Haiku | Requires API key     |
| OpenAI    | GPT-4o, GPT-4o-mini      | Requires API key     |
| Groq      | Llama 3.3, Mixtral       | Free tier available  |
| Ollama    | Llama, Mistral, etc.     | Local, no key needed |

---

## 4. AWS Implementation (Focus)

This section describes each AWS implementation step in detail.

### 4.1 Prerequisites

```bash
# Verify AWS CLI is installed
aws --version

# Configure credentials
aws configure
# → AWS Access Key ID: [from IAM console]
# → AWS Secret Access Key: [from IAM console]
# → Default region: eu-central-1
# → Default output format: json

# Verify configuration
aws sts get-caller-identity
```

**Expected output:**

```json
{
  "UserId": "AIDAXXXXXXXXXXXX",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/YourUser"
}
```

### 4.2 Creating the S3 Bucket

```bash
# Create the bucket
aws s3 mb s3://your-bucket-name --region eu-central-1

# Enable versioning (for backup/recovery)
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

**Data structure in the bucket:**

```
s3://your-bucket-name/
└── daily-logs/
    ├── 2025-12-27.json
    ├── 2025-12-28.json
    └── ...
```

**JSON file format:**

```json
{
  "date": "2025-12-28",
  "sessions": [
    {
      "id": "abc123",
      "projectId": "proj1",
      "startTime": "2025-12-28T09:00:00.000Z",
      "endTime": "2025-12-28T09:25:00.000Z",
      "duration": 1500,
      "date": "2025-12-28",
      "type": "work"
    }
  ],
  "projects": [
    {
      "id": "proj1",
      "name": "My Project",
      "color": "#00ff88"
    }
  ],
  "syncedAt": "2025-12-28T09:30:00.000Z"
}
```

### 4.3 Creating IAM Role for Lambda

The IAM role defines what Lambda can do.

**File: `trust-policy.json`**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Explanation:**

- `Principal.Service: lambda.amazonaws.com` → Only Lambda can assume this role
- `Action: sts:AssumeRole` → Allows Lambda to "become" this role

```bash
# Create the role
aws iam create-role \
  --role-name productivity-tracker-lambda-role \
  --assume-role-policy-document file://trust-policy.json
```

**File: `lambda-policy.json`**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

**Explanation:**

- `s3:PutObject` → Write files to S3
- `s3:GetObject` → Read files from S3
- `s3:ListBucket` → List files in bucket (for range queries)
- `logs:*` → Write logs to CloudWatch (debugging)

```bash
# Attach the policy to the role
aws iam put-role-policy \
  --role-name productivity-tracker-lambda-role \
  --policy-name productivity-tracker-s3-access \
  --policy-document file://lambda-policy.json
```

### 4.4 Creating the Lambda Function

See `aws/lambda-function.js` for the complete commented code.

**Lambda Deployment:**

```powershell
# Create ZIP (Windows PowerShell)
Compress-Archive -Path lambda-function.js -DestinationPath lambda-function.zip -Force

# Create the Lambda function
aws lambda create-function `
  --function-name productivity-tracker-sync `
  --runtime nodejs20.x `
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/productivity-tracker-lambda-role `
  --handler lambda-function.handler `
  --zip-file fileb://lambda-function.zip `
  --region eu-central-1 `
  --timeout 10
```

**Updating Lambda (after changes):**

```powershell
Compress-Archive -Path lambda-function.js -DestinationPath lambda-function.zip -Force

aws lambda update-function-code `
  --function-name productivity-tracker-sync `
  --zip-file fileb://lambda-function.zip `
  --region eu-central-1
```

### 4.5 Creating API Gateway (HTTP API)

API Gateway exposes the Lambda as a public HTTP endpoint.

```powershell
# Create the API
aws apigatewayv2 create-api `
  --name productivity-tracker-api `
  --protocol-type HTTP `
  --cors-configuration AllowOrigins="*",AllowMethods="GET,POST,OPTIONS",AllowHeaders="Content-Type" `
  --region eu-central-1
```

**Output (example):**

```json
{
  "ApiEndpoint": "https://abc123xyz.execute-api.eu-central-1.amazonaws.com",
  "ApiId": "abc123xyz",
  "Name": "productivity-tracker-api"
}
```

**Note the `ApiId`** (e.g., `abc123xyz`) - needed in subsequent commands.

```powershell
# Create Lambda integration
aws apigatewayv2 create-integration `
  --api-id YOUR_API_ID `
  --integration-type AWS_PROXY `
  --integration-uri arn:aws:lambda:eu-central-1:YOUR_ACCOUNT_ID:function:productivity-tracker-sync `
  --payload-format-version 2.0 `
  --region eu-central-1
```

**Note the `IntegrationId`** - needed in subsequent commands.

```powershell
# Create POST /sync route
aws apigatewayv2 create-route `
  --api-id YOUR_API_ID `
  --route-key "POST /sync" `
  --target integrations/YOUR_INTEGRATION_ID `
  --region eu-central-1

# Create GET /sync route
aws apigatewayv2 create-route `
  --api-id YOUR_API_ID `
  --route-key "GET /sync" `
  --target integrations/YOUR_INTEGRATION_ID `
  --region eu-central-1

# Create prod stage with auto-deploy
aws apigatewayv2 create-stage `
  --api-id YOUR_API_ID `
  --stage-name prod `
  --auto-deploy `
  --region eu-central-1

# Permission for API Gateway to invoke Lambda
aws lambda add-permission `
  --function-name productivity-tracker-sync `
  --statement-id apigateway-invoke `
  --action lambda:InvokeFunction `
  --principal apigateway.amazonaws.com `
  --source-arn "arn:aws:execute-api:eu-central-1:YOUR_ACCOUNT_ID:YOUR_API_ID/*/*/sync" `
  --region eu-central-1
```

### 4.6 Final Endpoint

```
https://YOUR_API_ID.execute-api.eu-central-1.amazonaws.com/prod/sync
```

**Testing the endpoint:**

```powershell
# Test POST (save data)
Invoke-RestMethod `
  -Uri "https://YOUR_API_ID.execute-api.eu-central-1.amazonaws.com/prod/sync" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"date":"2025-12-28","sessions":[],"projects":[]}'

# Test GET (retrieve data)
Invoke-RestMethod `
  -Uri "https://YOUR_API_ID.execute-api.eu-central-1.amazonaws.com/prod/sync?date=2025-12-28" `
  -Method GET

# Test GET range (for AI)
Invoke-RestMethod `
  -Uri "https://YOUR_API_ID.execute-api.eu-central-1.amazonaws.com/prod/sync?from=2025-12-01&to=2025-12-28" `
  -Method GET
```

### 4.7 AWS Resources Summary

| Resource    | Name                             | ARN/ID                                                                         |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------ |
| S3 Bucket   | your-bucket-name                 | arn:aws:s3:::your-bucket-name                                                  |
| IAM Role    | productivity-tracker-lambda-role | arn:aws:iam::YOUR_ACCOUNT_ID:role/productivity-tracker-lambda-role             |
| Lambda      | productivity-tracker-sync        | arn:aws:lambda:eu-central-1:YOUR_ACCOUNT_ID:function:productivity-tracker-sync |
| API Gateway | productivity-tracker-api         | YOUR_API_ID                                                                    |
| Endpoint    | -                                | https://YOUR_API_ID.execute-api.eu-central-1.amazonaws.com/prod/sync           |

---

## 5. Code Structure

### Directory Tree

```
productivity-tracker/
├── src/                          # Frontend
│   ├── index.html                # HTML structure
│   ├── styles.css                # CSS styles
│   ├── config.js                 # Configuration (API URL, etc.)
│   └── app.js                    # JavaScript logic
│
├── src-tauri/                    # Tauri/Rust Backend
│   ├── Cargo.toml                # Rust dependencies
│   ├── build.rs                  # Build script
│   ├── tauri.conf.json           # Tauri configuration
│   ├── capabilities/
│   │   └── default.json          # App permissions
│   ├── icons/                    # App icons
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   └── ...
│   └── src/
│       └── main.rs               # Rust entry point (~10 lines)
│
├── aws/                          # AWS Infrastructure
│   ├── lambda-function.js        # Lambda code
│   ├── trust-policy.json         # IAM trust policy
│   └── lambda-policy.json        # IAM permissions policy
│
├── .github/
│   └── workflows/
│       └── release.yml           # CI/CD for automatic builds
│
├── README.md                     # User documentation
├── LICENSE                       # MIT License
└── .gitignore
```

### Main Files

#### `src/config.js`

```javascript
const CONFIG = {
  API_URL: "https://YOUR_API_ID.execute-api.eu-central-1.amazonaws.com/prod",
  AUTO_SYNC_INTERVAL: 5, // minutes
  MIN_SESSION_DURATION: 60, // seconds
  DEFAULT_POMODORO: 25 * 60, // seconds
  DEBUG: false,
  AI_PROVIDERS: {
    /* ... */
  },
  RADIO_STATIONS: [
    /* ... */
  ],
};
```

#### `src/app.js` - Key Functions

| Function                          | Purpose                         |
| --------------------------------- | ------------------------------- |
| `startTimer(projectId)`           | Start timer for a project       |
| `stopTimer(save)`                 | Stop timer, save session        |
| `pauseTimer()` / `resumeTimer()`  | Pause handling                  |
| `startBreak(duration)`            | Start Pomodoro break            |
| `syncToAWS()`                     | Send data to S3 via API Gateway |
| `loadFromAWS(date)`               | Load data from S3               |
| `mergeFromAWS()`                  | Merge local and remote data     |
| `loadHistoryFromAWS(days)`        | Load history for AI             |
| `generateAISuggestions()`         | Call AI provider                |
| `callAI(prompt)`                  | Multi-provider dispatcher       |
| `getStats()`                      | Calculate statistics            |
| `initCharts()` / `updateCharts()` | Chart management                |
| `initMusicPlayer()`               | Focus music player              |

#### `src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 6. Data Flow

### 6.1 Saving Session (Local + Cloud)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ User clicks │────▶│ stopTimer()      │────▶│ state.sessions  │
│   "Stop"    │     │                  │     │    .push()      │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                    ┌─────────────────────────────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │ saveSessions()         │
       │ • localStorage.setItem │
       │ • Storage.save (Tauri) │
       └────────────────────────┘
                    │
                    │ (every 5 min or manual)
                    ▼
       ┌────────────────────────┐     ┌─────────────────────┐
       │ syncToAWS()            │────▶│ API Gateway         │
       │ • fetch POST /sync     │     │ → Lambda            │
       │ • payload: sessions    │     │ → S3 PutObject      │
       └────────────────────────┘     └─────────────────────┘
```

### 6.2 Loading at Startup

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  App Start  │────▶│ loadData()       │────▶│ localStorage    │
│             │     │                  │     │ (local data)    │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                    ┌─────────────────────────────────┘
                    │
                    ▼
       ┌────────────────────────┐     ┌─────────────────────┐
       │ mergeFromAWS()         │────▶│ API Gateway         │
       │ • fetch GET /sync      │     │ → Lambda            │
       │ • merge with local     │     │ → S3 GetObject      │
       └────────────────────────┘     └─────────────────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │ Unified data           │
       │ (local + cloud)        │
       └────────────────────────┘
```

### 6.3 AI Analysis

```
┌─────────────────┐     ┌────────────────────┐     ┌──────────────────┐
│ User clicks     │────▶│ loadHistoryFromAWS │────▶│ GET /sync?from=  │
│ "Generate AI"   │     │ (30 days)          │     │ &to=...          │
└─────────────────┘     └────────────────────┘     └────────┬─────────┘
                                                            │
                        ┌───────────────────────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │ Build prompt           │
           │ • statistics           │
           │ • hourly patterns      │
           │ • project distribution │
           └────────────┬───────────┘
                        │
                        ▼
           ┌────────────────────────┐     ┌─────────────────┐
           │ callAI(prompt)         │────▶│ Chosen provider │
           │ • Anthropic            │     │ (external API)  │
           │ • OpenAI               │     └─────────────────┘
           │ • Groq                 │
           │ • Ollama               │
           └────────────────────────┘
```

---

## 7. Configuration and Deployment

### 7.1 Local Development

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli

# System dependencies (Ubuntu)
sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev

# Start in dev mode
cd productivity-tracker
cp src/config.example.js src/config.js  # Edit with your API URL
cargo tauri dev
```

### 7.2 Production Build

```bash
cargo tauri build
```

Output in `src-tauri/target/release/bundle/`:

- Windows: `.msi`, `.exe`
- macOS: `.dmg`, `.app`
- Linux: `.deb`, `.AppImage`

### 7.3 CI/CD with GitHub Actions

The `.github/workflows/release.yml` file automates:

1. Build for Windows, macOS, Linux
2. GitHub release creation
3. Installer upload

Trigger: push a `v*` tag (e.g., `v1.0.0`)

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 8. Security

### 8.1 Authentication and Authorization

**Current setup (simplified for personal use):**

- Public API Gateway (no authentication)
- S3 access only via Lambda (not direct)
- AI API keys saved in localStorage (local only)

**For multi-user usage, add:**

- Amazon Cognito for user authentication
- API key or JWT on API Gateway
- Per-user data partitioning in S3

### 8.2 Sensitive Data

| Data            | Where stored      | Protection                 |
| --------------- | ----------------- | -------------------------- |
| Work sessions   | localStorage + S3 | S3 encryption at rest      |
| Projects        | localStorage + S3 | S3 encryption at rest      |
| AI API keys     | localStorage      | Local only, never on cloud |
| AWS credentials | AWS CLI config    | Not in the app             |

### 8.3 CORS

Lambda returns permissive CORS headers:

```javascript
'Access-Control-Allow-Origin': '*'
```

For multi-user production, restrict to specific domains.

### 8.4 Principle of Least Privilege

Lambda has only strictly necessary permissions:

- S3: only the specific bucket
- Actions: only PutObject, GetObject, ListBucket
- CloudWatch Logs: for debugging

---

## 9. Estimated AWS Costs

### Typical Usage (personal, ~50 syncs/day)

| Service     | Monthly usage      | Cost              |
| ----------- | ------------------ | ----------------- |
| S3 Storage  | < 100 MB           | $0.002            |
| S3 Requests | ~1,500 PUT/GET     | $0.01             |
| Lambda      | ~1,500 invocations | $0.00 (free tier) |
| API Gateway | ~1,500 requests    | $0.002            |
| **Total**   |                    | **~$0.02/month**  |

### AWS Free Tier (first year)

- Lambda: 1M requests/month free
- API Gateway: 1M requests/month free
- S3: 5GB storage free

**Effective cost first year: $0**

---

## 10. Troubleshooting

### Problem: "InvalidClientTokenId" in AWS CLI

**Cause:** Invalid or expired AWS credentials.

**Solution:**

```bash
aws configure
# Enter new Access Key from IAM console
```

### Problem: Lambda returns "Not found"

**Cause:** Path not recognized by Lambda.

**Solution:** Verify Lambda uses `event.rawPath` and checks with `.endsWith('/sync')`:

```javascript
const path = event.rawPath || event.requestContext?.http?.path || event.path;
if (method === 'POST' && path.endsWith('/sync')) { ... }
```

### Problem: CORS error in browser

**Cause:** Missing CORS headers in Lambda response.

**Solution:** Verify Lambda always returns:

```javascript
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
```

### Problem: Chart shows "No data this week"

**Cause:** Sessions too short converted to 0 hours.

**Solution:** Use seconds as internal value, show minutes if < 1 hour:

```javascript
const value =
  totalSeconds >= 3600
    ? Math.round((totalSeconds / 3600) * 10) / 10
    : Math.round(totalSeconds / 60);
const unit = totalSeconds >= 3600 ? "h" : "m";
```

### Problem: AI not working

**Verify:**

1. API key entered and saved
2. Provider selected correctly
3. Console for specific errors (F12)

**For Ollama:** must be running locally on port 11434.

---

## Appendix: Complete AWS Commands

```powershell
# ===== S3 =====
aws s3 mb s3://your-bucket-name --region eu-central-1
aws s3api put-bucket-versioning --bucket your-bucket-name --versioning-configuration Status=Enabled
aws s3 ls s3://your-bucket-name/daily-logs/

# ===== IAM =====
aws iam create-role --role-name productivity-tracker-lambda-role --assume-role-policy-document file://trust-policy.json
aws iam put-role-policy --role-name productivity-tracker-lambda-role --policy-name productivity-tracker-s3-access --policy-document file://lambda-policy.json

# ===== LAMBDA =====
Compress-Archive -Path lambda-function.js -DestinationPath lambda-function.zip -Force
aws lambda create-function --function-name productivity-tracker-sync --runtime nodejs20.x --role arn:aws:iam::YOUR_ACCOUNT_ID:role/productivity-tracker-lambda-role --handler lambda-function.handler --zip-file fileb://lambda-function.zip --region eu-central-1 --timeout 10
aws lambda update-function-code --function-name productivity-tracker-sync --zip-file fileb://lambda-function.zip --region eu-central-1

# ===== API GATEWAY =====
aws apigatewayv2 create-api --name productivity-tracker-api --protocol-type HTTP --cors-configuration AllowOrigins="*",AllowMethods="GET,POST,OPTIONS",AllowHeaders="Content-Type" --region eu-central-1
aws apigatewayv2 create-integration --api-id YOUR_API_ID --integration-type AWS_PROXY --integration-uri arn:aws:lambda:eu-central-1:YOUR_ACCOUNT_ID:function:productivity-tracker-sync --payload-format-version 2.0 --region eu-central-1
aws apigatewayv2 create-route --api-id YOUR_API_ID --route-key "POST /sync" --target integrations/YOUR_INTEGRATION_ID --region eu-central-1
aws apigatewayv2 create-route --api-id YOUR_API_ID --route-key "GET /sync" --target integrations/YOUR_INTEGRATION_ID --region eu-central-1
aws apigatewayv2 create-stage --api-id YOUR_API_ID --stage-name prod --auto-deploy --region eu-central-1
aws lambda add-permission --function-name productivity-tracker-sync --statement-id apigateway-invoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:eu-central-1:YOUR_ACCOUNT_ID:YOUR_API_ID/*/*/sync" --region eu-central-1

# ===== TEST =====
Invoke-RestMethod -Uri "https://YOUR_API_ID.execute-api.eu-central-1.amazonaws.com/prod/sync" -Method POST -ContentType "application/json" -Body '{"date":"2025-12-28","sessions":[],"projects":[]}'
```

---

_Documentation generated December 28, 2025_
_Version: 1.0.0_
