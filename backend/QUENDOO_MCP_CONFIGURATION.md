# Quendoo MCP Server Configuration Guide

## Overview

The Quendoo AI Dashboard backend is now configured to work with the Quendoo MCP server. However, the exact message format expected by the server needs to be configured based on the actual API specification.

## Current Implementation Status

✅ **Complete:**
- Session ID retrieval from SSE endpoint
- Connection management
- Error handling and logging
- Flexible service architecture

⚠️ **Needs Configuration:**
- Exact JSON message format (currently returns `400 Could not parse message`)

## How the Quendoo MCP Server Works

### 1. Session Initialization

The server uses Server-Sent Events (SSE) to establish a session:

```bash
GET https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse
Accept: text/event-stream
```

**Response:**
```
event: endpoint
data: /messages/?session_id=<32-character-hex-id>
```

### 2. Sending Messages

Once you have a session ID, you can send messages:

```bash
POST https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/messages/?session_id=<session-id>
Content-Type: application/json

{
  "message": "Your message here"  # ← This format needs verification
}
```

## Configuring the Message Format

### File to Edit

Edit: `backend/src/Services/QuendooMCPService.php`

Find the `buildMessagePayload()` method (around line 125).

### Common Message Formats to Try

The method currently tries:
```php
return ['message' => $message];
```

Here are alternative formats you can try:

#### Option 1: Content Key
```php
return ['content' => $message];
```

#### Option 2: With Conversation Context
```php
return [
    'message' => $message,
    'conversation_id' => $conversationId
];
```

#### Option 3: OpenAI-Style Messages Array
```php
return [
    'messages' => [
        ['role' => 'user', 'content' => $message]
    ]
];
```

#### Option 4: With Additional Metadata
```php
return [
    'input' => $message,
    'session_id' => $this->currentSessionId,
    'conversation_id' => $conversationId,
    'timestamp' => date('c')
];
```

#### Option 5: Text Key
```php
return ['text' => $message];
```

#### Option 6: Query Key
```php
return ['query' => $message];
```

## Testing the Configuration

### Method 1: Using the Test Script

Run the test script to try sending a message:

```bash
cd "c:\Quendoo AI Dashboard"
php test-mcp.php
```

### Method 2: Using curl

```bash
# Step 1: Get session ID
curl -k https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/sse

# Step 2: Use the session ID (replace <SESSION_ID>)
curl -k -X POST \
  "https://quendoo-mcp-server-urxohjcmba-uc.a.run.app/messages/?session_id=<SESSION_ID>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Give me the availability for January"}'
```

### Method 3: Through the Dashboard API

Start the backend server:
```bash
cd backend
php -S localhost:8080 -t public
```

Then send a test message via the API:
```bash
curl -X POST http://localhost:8080/chat/send \
  -H "Content-Type: application/json" \
  -d '{"content":"Give me the availability for January"}'
```

Check the logs at `backend/storage/logs/app.log` for detailed information.

## Once You Have the Correct Format

### Step 1: Update buildMessagePayload()

Edit `backend/src/Services/QuendooMCPService.php`:

```php
private function buildMessagePayload(string $message, string $conversationId): array
{
    // Replace this with the correct format
    return [
        'message' => $message  // ← Update this
    ];
}
```

### Step 2: Test

Restart the PHP server and test:

```bash
curl -X POST http://localhost:8080/chat/send \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello, test message"}'
```

### Step 3: Check Response

A successful response should look like:

```json
{
  "status": "success",
  "conversationId": "conv_...",
  "response": {
    "role": "assistant",
    "content": "Response from Quendoo MCP",
    "timestamp": "2026-01-03T..."
  }
}
```

## Switching Between MCP Implementations

### Use Quendoo MCP Service (default)

In `backend/.env`:
```env
USE_QUENDOO_MCP=true
```

### Use Generic JSON-RPC MCP Service

In `backend/.env`:
```env
USE_QUENDOO_MCP=false
```

## Debugging

### Enable Debug Logging

In `backend/.env`:
```env
LOG_LEVEL=debug
APP_DEBUG=true
```

### Check Logs

View logs in real-time:
```bash
tail -f backend/storage/logs/app.log
```

### Common Issues

**Issue: "Invalid session ID"**
- Session IDs expire quickly
- Get a fresh session ID before each test
- The service automatically refreshes sessions

**Issue: "Could not parse message"**
- The message format is incorrect
- Try different formats in `buildMessagePayload()`
- Check Quendoo documentation for the correct schema

**Issue: "Connection timeout"**
- Check if the MCP server URL is correct
- Verify SSL settings (disable verify in development)

## Additional Configuration

### Adjust Timeouts

In `backend/src/Services/QuendooMCPService.php`:

```php
$clientOptions = [
    'timeout' => 30,  // Increase if needed
    ...
];
```

### Session Management

```php
// Force new session
$quendooMCP->resetSession();

// Get current session ID
$sessionId = $quendooMCP->getCurrentSessionId();
```

## Getting Help

If you're still unable to determine the correct format:

1. **Check Internal Documentation:**
   - Look for Quendoo MCP API docs
   - Check OpenAPI/Swagger specifications
   - Review internal wikis or READMEs

2. **Inspect Working Clients:**
   - If you have a working frontend/client
   - Use browser DevTools Network tab
   - Copy the exact request format

3. **Contact Quendoo Team:**
   - Request API documentation
   - Ask for example requests/responses
   - Request Postman collection or curl examples

## Example: Full Working Implementation

Once you know the format, here's an example of what a complete working implementation might look like:

```php
// In buildMessagePayload()
private function buildMessagePayload(string $message, string $conversationId): array
{
    // Example: If Quendoo expects this format
    return [
        'query' => $message,
        'context' => [
            'conversation_id' => $conversationId,
            'user_id' => 'dashboard_user',
            'timestamp' => date('c')
        ],
        'options' => [
            'stream' => false,
            'max_tokens' => 2000
        ]
    ];
}
```

## Support

For additional help:
- Check logs: `backend/storage/logs/app.log`
- Review test output: `php test-mcp.php`
- Enable verbose curl: `curl -v ...`
