# Logging System Documentation

## Overview

The Quendoo AI Dashboard uses a centralized structured logging system that integrates with **Google Cloud Logging** in production and provides console output for local development.

## Features

- **Structured logging** with JSON metadata
- **Multiple log levels**: DEBUG, INFO, WARN, ERROR, CRITICAL
- **Request correlation IDs** (X-Request-ID) for distributed tracing
- **Automatic HTTP request/response logging**
- **Google Cloud Logging integration** in production
- **Console fallback** for local development
- **Configurable log level filtering** via environment variable

## Usage

### Basic Logging

```javascript
import logger from './utils/logger.js';

// Different log levels
logger.debug('Debug message', { userId: '123' });
logger.info('User registered', { userId: '123', email: 'user@example.com' });
logger.warn('API rate limit approaching', { usage: 95 });
logger.error('Database connection failed', { error: err.message });
logger.critical('System shutdown initiated', { reason: 'critical failure' });
```

### HTTP Logging

HTTP requests and responses are automatically logged by the middleware:

```javascript
// In src/index.js
import { addCorrelationId, logHttpRequests, logErrors } from './middleware/requestLogger.js';

app.use(addCorrelationId);  // Adds X-Request-ID header
app.use(logHttpRequests);   // Logs all HTTP requests/responses
```

### Error Logging

```javascript
try {
  await riskyOperation();
} catch (error) {
  logger.logError(error, {
    operation: 'riskyOperation',
    userId: req.user?.id,
    requestId: req.requestId
  });
  throw error;
}
```

### Request Correlation

Every HTTP request automatically gets a unique correlation ID that can be used to trace the request across services:

```javascript
// Access correlation ID in route handlers
app.post('/api/endpoint', (req, res) => {
  logger.info('Processing request', {
    requestId: req.requestId,  // Automatically added by middleware
    userId: req.user?.id
  });
});
```

## Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| DEBUG | Detailed debugging information | `logger.debug('Variable value', { value: x })` |
| INFO | General informational messages | `logger.info('User logged in', { userId })` |
| WARN | Warning messages (recoverable issues) | `logger.warn('API rate limit reached', { limit })` |
| ERROR | Error messages (recoverable errors) | `logger.error('Failed to send email', { error })` |
| CRITICAL | Critical issues (system failure) | `logger.critical('Database down', { error })` |

## Configuration

### Environment Variables

```bash
# Set log level (default: INFO in production, DEBUG in development)
LOG_LEVEL=INFO

# Valid values: DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### Log Level Filtering

Only logs at or above the configured level will be output:

- `DEBUG` → Shows all logs
- `INFO` → Shows INFO, WARN, ERROR, CRITICAL
- `WARNING` → Shows WARN, ERROR, CRITICAL
- `ERROR` → Shows ERROR, CRITICAL
- `CRITICAL` → Shows only CRITICAL

## Viewing Logs

### Local Development

Logs are printed to console with timestamps:

```
[2026-01-07T07:40:57.191Z] [INFO] HTTP Request {"method":"GET","path":"/health","requestId":"5f80ac83-e3dd-45fd-a169-0ef1ec6c207f"}
```

### Production (Google Cloud Logging)

#### Via gcloud CLI

```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND logName=projects/quendoo-ai-dashboard/logs/quendoo-backend" --limit=50 --project quendoo-ai-dashboard

# Filter by severity
gcloud logging read "resource.type=cloud_run_revision AND severity=ERROR" --limit=20 --project quendoo-ai-dashboard

# Filter by request ID (trace a specific request)
gcloud logging read "jsonPayload.requestId='5f80ac83-e3dd-45fd-a169-0ef1ec6c207f'" --project quendoo-ai-dashboard

# Filter by hotel ID
gcloud logging read "jsonPayload.hotelId='hotel_abc123'" --limit=50 --project quendoo-ai-dashboard

# Real-time streaming
gcloud logging tail "resource.type=cloud_run_revision" --project quendoo-ai-dashboard
```

#### Via Google Cloud Console

1. Go to [Cloud Console Logs Explorer](https://console.cloud.google.com/logs)
2. Select your project: `quendoo-ai-dashboard`
3. Use the query builder:
   ```
   resource.type="cloud_run_revision"
   logName="projects/quendoo-ai-dashboard/logs/quendoo-backend"
   severity="ERROR"
   ```

## Log Structure

All logs include the following metadata:

```json
{
  "message": "Hotel login successful",
  "severity": "INFO",
  "timestamp": "2026-01-07T07:40:57.191Z",
  "jsonPayload": {
    "message": "Hotel login successful",
    "hotelId": "hotel_abc123",
    "email": "hotel@example.com",
    "requestId": "5f80ac83-e3dd-45fd-a169-0ef1ec6c207f",
    "ip": "78.90.187.196",
    "environment": "production",
    "service": "quendoo-backend",
    "revision": "quendoo-backend-00097-z2g"
  },
  "resource": {
    "type": "cloud_run_revision",
    "labels": {
      "service_name": "quendoo-backend",
      "revision_name": "quendoo-backend-00097-z2g",
      "location": "us-central1"
    }
  }
}
```

## Common Use Cases

### Debugging Failed Hotel Registration

```bash
# Find all registration errors
gcloud logging read "jsonPayload.message:'Hotel registration failed'" --limit=20 --project quendoo-ai-dashboard

# Trace a specific registration attempt
gcloud logging read "jsonPayload.hotelId='hotel_abc123' AND timestamp>='2026-01-07T00:00:00Z'" --project quendoo-ai-dashboard
```

### Monitoring API Performance

```bash
# Find slow requests (>5 seconds)
gcloud logging read "jsonPayload.duration>5000" --limit=50 --project quendoo-ai-dashboard

# View all 5xx errors
gcloud logging read "jsonPayload.statusCode>=500" --limit=50 --project quendoo-ai-dashboard
```

### Security Monitoring

```bash
# Failed login attempts
gcloud logging read "jsonPayload.message:'Login failed'" --limit=100 --project quendoo-ai-dashboard

# Suspicious activity from specific IP
gcloud logging read "jsonPayload.ip='suspicious.ip.address'" --project quendoo-ai-dashboard
```

## Best Practices

1. **Always include requestId** in custom logs within route handlers
2. **Use appropriate log levels** - don't log everything as ERROR
3. **Include contextual metadata** - hotelId, userId, operation name
4. **Don't log sensitive data** - passwords, API keys, tokens
5. **Use structured data** - pass objects instead of concatenating strings
6. **Keep messages concise** - details go in metadata

### ✅ Good Example

```javascript
logger.info('Hotel registration successful', {
  hotelId,
  hotelName,
  contactEmail,
  requestId: req.requestId
});
```

### ❌ Bad Example

```javascript
logger.info(`Hotel registration successful for hotel ${hotelId} named ${hotelName} with email ${contactEmail} and password ${password}`);
// Issues:
// - No structured metadata
// - String concatenation
// - Logs sensitive password!
```

## Cost Optimization

Google Cloud Logging pricing: ~$0.50/GB ingested

To reduce costs:

1. **Use appropriate log levels** in production (INFO or higher)
2. **Sample high-volume logs** (e.g., successful health checks)
3. **Set log retention policies** (default: 30 days)
4. **Filter out noisy logs** at the application level

```javascript
// Sample health check logs (only log 1 in 100)
if (req.path === '/health' && Math.random() > 0.01) {
  return next(); // Skip logging
}
```

## Troubleshooting

### Logs not appearing in Cloud Logging

1. Check Cloud Run service account has `roles/logging.logWriter` permission
2. Verify logs are being written to console (they're automatically captured)
3. Check log level configuration - logs below threshold won't appear

### Too many logs / High costs

1. Increase log level to WARNING or ERROR in production
2. Add sampling for high-frequency endpoints
3. Review and remove debug logs from production code

### Can't trace request across services

1. Ensure correlation ID middleware is enabled
2. Pass `X-Request-ID` header between services
3. Include requestId in all log statements within request handlers

## Related Documentation

- [Google Cloud Logging Docs](https://cloud.google.com/logging/docs)
- [Cloud Run Logging Best Practices](https://cloud.google.com/run/docs/logging)
- [Express.js Logging Guide](https://expressjs.com/en/guide/debugging.html)
