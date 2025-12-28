/**
 * PRODUCTIVITY TRACKER - AWS LAMBDA FUNCTION
 * 
 * This Lambda function handles the API for syncing productivity data to S3.
 * It's designed to be used with API Gateway HTTP API (v2).
 * 
 * ENDPOINTS:
 *   POST /sync              - Save daily productivity data
 *   GET  /sync?date=YYYY-MM-DD     - Retrieve single day data
 *   GET  /sync?from=YYYY-MM-DD&to=YYYY-MM-DD - Retrieve date range
 * 
 * S3 STRUCTURE:
 *   s3://bucket-name/
 *   └── daily-logs/
 *       ├── 2025-01-01.json
 *       ├── 2025-01-02.json
 *       └── ...
 * 
 * REQUIRED IAM PERMISSIONS:
 *   - s3:PutObject
 *   - s3:GetObject
 *   - s3:ListBucket
 *   - logs:CreateLogGroup
 *   - logs:CreateLogStream
 *   - logs:PutLogEvents
 * 
 * @author Alessio Ferrari
 * @version 1.0.0
 * @license MIT
 */

// =============================================================================
// IMPORTS & CONFIGURATION
// =============================================================================

const { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  ListObjectsV2Command 
} = require('@aws-sdk/client-s3');

/**
 * S3 Client Configuration
 * Region should match your bucket's region for optimal performance
 */
const s3 = new S3Client({ region: 'eu-central-1' });

/**
 * S3 Bucket Name
 * ⚠️  CHANGE THIS to your own bucket name before deploying!
 */
const BUCKET = 'your-bucket-name-here';

// =============================================================================
// MAIN HANDLER
// =============================================================================

/**
 * Lambda Handler Function
 * 
 * Processes incoming HTTP requests from API Gateway and routes them
 * to the appropriate handler based on method and path.
 * 
 * @param {Object} event - API Gateway event object (payload format 2.0)
 * @returns {Object} HTTP response with statusCode, headers, and body
 */
exports.handler = async (event) => {
  // Log incoming event for debugging (visible in CloudWatch)
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  // ---------------------------------------------------------------------
  // CORS Headers
  // These headers allow the app to call the API from any origin.
  // For production with authentication, restrict AllowedOrigins.
  // ---------------------------------------------------------------------
  const headers = {
    'Access-Control-Allow-Origin': '*',           // Allow all origins (adjust for production)
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // ---------------------------------------------------------------------
  // Handle CORS Preflight Requests
  // Browsers send OPTIONS requests before actual requests to check CORS
  // ---------------------------------------------------------------------
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Extract HTTP method and path from the event
    // Support both API Gateway HTTP API (v2) and REST API (v1) formats
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.requestContext?.http?.path || event.path;
    
    console.log('Method:', method, 'Path:', path);

    // ===================================================================
    // POST /sync - Save Daily Productivity Data
    // ===================================================================
    if (method === 'POST' && path.endsWith('/sync')) {
      return await handlePostSync(event, headers);
    }

    // ===================================================================
    // GET /sync - Retrieve Productivity Data
    // ===================================================================
    if (method === 'GET' && path.endsWith('/sync')) {
      return await handleGetSync(event, headers);
    }

    // ===================================================================
    // 404 - Route Not Found
    // ===================================================================
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found', method, path })
    };

  } catch (error) {
    // ---------------------------------------------------------------------
    // Global Error Handler
    // Catches any unhandled errors and returns a 500 response
    // ---------------------------------------------------------------------
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * Handle POST /sync
 * 
 * Saves daily productivity data to S3. Each day's data is stored in a
 * separate JSON file named by date (e.g., daily-logs/2025-01-15.json).
 * 
 * Request Body:
 * {
 *   "date": "2025-01-15",
 *   "sessions": [
 *     {
 *       "id": "abc123",
 *       "projectId": "proj1",
 *       "startTime": "2025-01-15T09:00:00.000Z",
 *       "endTime": "2025-01-15T09:25:00.000Z",
 *       "duration": 1500,
 *       "type": "work"
 *     }
 *   ],
 *   "projects": [
 *     { "id": "proj1", "name": "My Project", "color": "#00ff88" }
 *   ]
 * }
 * 
 * @param {Object} event - API Gateway event
 * @param {Object} headers - Response headers
 * @returns {Object} HTTP response
 */
async function handlePostSync(event, headers) {
  // Parse the JSON body from the request
  const body = JSON.parse(event.body);
  const { date, sessions, projects } = body;

  // Construct the S3 key (file path)
  const key = `daily-logs/${date}.json`;
  
  // Prepare the data object to store
  const dataToStore = {
    date,
    sessions,
    projects,
    syncedAt: new Date().toISOString()  // Timestamp for tracking last sync
  };

  // Upload to S3
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(dataToStore),
    ContentType: 'application/json'
  }));

  console.log('Data saved to S3:', key);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, key, date })
  };
}

/**
 * Handle GET /sync
 * 
 * Retrieves productivity data from S3. Supports two modes:
 * 
 * 1. Single Day: GET /sync?date=2025-01-15
 *    Returns data for a specific date
 * 
 * 2. Date Range: GET /sync?from=2025-01-01&to=2025-01-31
 *    Returns aggregated data for a date range (used by AI analysis)
 * 
 * @param {Object} event - API Gateway event
 * @param {Object} headers - Response headers
 * @returns {Object} HTTP response
 */
async function handleGetSync(event, headers) {
  const params = event.queryStringParameters || {};
  
  // -----------------------------------------------------------------
  // Date Range Query (for AI analysis)
  // Returns all sessions and projects within the specified range
  // -----------------------------------------------------------------
  if (params.from && params.to) {
    return await handleGetDateRange(params.from, params.to, headers);
  }
  
  // -----------------------------------------------------------------
  // Single Date Query
  // Returns data for a specific day
  // -----------------------------------------------------------------
  const date = params.date;
  if (!date) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing date parameter' })
    };
  }

  return await handleGetSingleDate(date, headers);
}

/**
 * Handle GET /sync?date=YYYY-MM-DD
 * 
 * Retrieves data for a single day from S3.
 * 
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Object} headers - Response headers
 * @returns {Object} HTTP response
 */
async function handleGetSingleDate(date, headers) {
  const key = `daily-logs/${date}.json`;
  
  try {
    const response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key
    }));
    
    // Convert stream to string
    const data = await response.Body.transformToString();
    
    console.log('Data retrieved from S3:', key);
    
    return { statusCode: 200, headers, body: data };
    
  } catch (e) {
    // Handle case where file doesn't exist
    if (e.name === 'NoSuchKey') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No data for this date' })
      };
    }
    throw e;  // Re-throw other errors to be caught by global handler
  }
}

/**
 * Handle GET /sync?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 
 * Retrieves and aggregates data for a date range. This is used by the
 * AI analysis feature to analyze productivity patterns over time.
 * 
 * Process:
 * 1. List all files in the daily-logs/ prefix
 * 2. Filter files within the date range
 * 3. Load and merge all sessions and projects
 * 4. Return aggregated data
 * 
 * @param {string} from - Start date in YYYY-MM-DD format
 * @param {string} to - End date in YYYY-MM-DD format
 * @param {Object} headers - Response headers
 * @returns {Object} HTTP response with aggregated data
 */
async function handleGetDateRange(from, to, headers) {
  // Arrays to collect all sessions and unique projects
  const sessions = [];
  const projects = new Map();  // Use Map to deduplicate by project ID
  
  // -----------------------------------------------------------------
  // Step 1: List all files in the daily-logs/ prefix
  // -----------------------------------------------------------------
  const listResponse = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: 'daily-logs/'
  }));
  
  // -----------------------------------------------------------------
  // Step 2: Filter files within the date range
  // Extract date from filename and compare with range
  // -----------------------------------------------------------------
  const files = (listResponse.Contents || [])
    .map(obj => obj.Key)
    .filter(key => {
      // Extract date from filename (e.g., "daily-logs/2025-01-15.json" -> "2025-01-15")
      const dateMatch = key.match(/daily-logs\/(\d{4}-\d{2}-\d{2})\.json/);
      if (!dateMatch) return false;
      
      const fileDate = dateMatch[1];
      // String comparison works for ISO dates (YYYY-MM-DD)
      return fileDate >= from && fileDate <= to;
    });
  
  console.log(`Found ${files.length} files in range ${from} to ${to}`);
  
  // -----------------------------------------------------------------
  // Step 3: Load each file and merge data
  // -----------------------------------------------------------------
  for (const fileKey of files) {
    try {
      const response = await s3.send(new GetObjectCommand({
        Bucket: BUCKET,
        Key: fileKey
      }));
      const data = JSON.parse(await response.Body.transformToString());
      
      // Merge sessions (append all)
      if (data.sessions) {
        sessions.push(...data.sessions);
      }
      
      // Merge projects (deduplicate by ID)
      if (data.projects) {
        data.projects.forEach(p => projects.set(p.id, p));
      }
      
    } catch (e) {
      // Log warning but continue processing other files
      console.warn('Error loading file:', fileKey, e.message);
    }
  }
  
  // -----------------------------------------------------------------
  // Step 4: Return aggregated response
  // -----------------------------------------------------------------
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      from,
      to,
      sessions,
      projects: Array.from(projects.values()),
      filesLoaded: files.length
    })
  };
}

// =============================================================================
// DATA STRUCTURES REFERENCE
// =============================================================================

/**
 * Session Object Structure:
 * {
 *   "id": "abc123xyz",           // Unique identifier
 *   "projectId": "proj1",        // Reference to project
 *   "startTime": "ISO8601",      // Session start timestamp
 *   "endTime": "ISO8601",        // Session end timestamp
 *   "duration": 1500,            // Duration in seconds
 *   "date": "2025-01-15",        // Date string for filtering
 *   "type": "work|break|pomodoro" // Session type
 * }
 * 
 * Project Object Structure:
 * {
 *   "id": "proj1",               // Unique identifier
 *   "name": "My Project",        // Display name
 *   "color": "#00ff88"           // Hex color for UI
 * }
 * 
 * Daily Log Structure (stored in S3):
 * {
 *   "date": "2025-01-15",
 *   "sessions": [...],
 *   "projects": [...],
 *   "syncedAt": "ISO8601"        // Last sync timestamp
 * }
 */
