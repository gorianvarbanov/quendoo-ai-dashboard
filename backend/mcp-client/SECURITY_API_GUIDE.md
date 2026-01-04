# Security Management API Guide

This guide explains how to use the admin API endpoints to manage security rules and configuration dynamically.

## Authentication

All admin endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

Get a token by logging in at `/admin/login`.

---

## API Endpoints

### 1. Get Current Security Configuration

**GET** `/admin/security/config`

Retrieves the current security configuration including all validation rules.

**Response:**
```json
{
  "success": true,
  "config": {
    "input": {
      "maxLength": 2000,
      "allowControlCharacters": false,
      "injectionPatterns": [
        "ignore\\s+(previous|above|all|prior)\\s+(instructions?|rules?|prompts?)",
        "forget\\s+(everything|all|previous|your)",
        ...
      ],
      "offTopicKeywords": {
        "medical": ["medicine", "medication", ...],
        "cooking": ["recipe", "ingredient", ...],
        ...
      },
      "hotelKeywords": ["room", "booking", "reservation", ...]
    },
    "output": {
      "offTopicIndicators": {...},
      "jailbreakIndicators": [...],
      "sensitivePatterns": [...]
    },
    "tools": {
      "disabledTools": [],
      "parameterRules": ["update_availability"]
    },
    "rateLimits": {
      "maxMessagesPerMinute": 20,
      "perToolLimits": {
        "make_call": 3,
        "send_quendoo_email": 5
      }
    }
  }
}
```

---

### 2. Add Injection Pattern

**POST** `/admin/security/injection-patterns/add`

Add a new prompt injection detection pattern.

**Request Body:**
```json
{
  "pattern": "your\\s+regex\\s+pattern",
  "flags": "i"
}
```

- `pattern` (required): Regular expression pattern to detect
- `flags` (optional): Regex flags, default is "i" (case-insensitive)

**Response:**
```json
{
  "success": true,
  "message": "Injection pattern added successfully"
}
```

**Example:**
```bash
curl -X POST https://your-backend/admin/security/injection-patterns/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "bypass\\s+security",
    "flags": "i"
  }'
```

---

### 3. Add Off-Topic Keywords

**POST** `/admin/security/off-topic-keywords/add`

Add keywords to an off-topic category to improve detection.

**Request Body:**
```json
{
  "category": "medical",
  "keywords": ["diagnosis", "prescription", "treatment"]
}
```

- `category` (required): Category name (medical, cooking, programming, gardening)
- `keywords` (required): Array of keywords to add

**Response:**
```json
{
  "success": true,
  "message": "Keywords added to medical category"
}
```

**Example:**
```bash
curl -X POST https://your-backend/admin/security/off-topic-keywords/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "medical",
    "keywords": ["symptom", "diagnosis", "cure"]
  }'
```

---

### 4. Add Hotel Keywords

**POST** `/admin/security/hotel-keywords/add`

Add hotel-related keywords to reduce false positives in off-topic detection.

**Request Body:**
```json
{
  "keywords": ["suite", "accommodation", "lodge"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Hotel keywords added successfully"
}
```

**Example:**
```bash
curl -X POST https://your-backend/admin/security/hotel-keywords/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["villa", "resort", "inn"]
  }'
```

---

### 5. Update Rate Limits

**PUT** `/admin/security/rate-limits`

Update conversation and tool-specific rate limits.

**Request Body:**
```json
{
  "maxMessagesPerMinute": 30,
  "perToolLimits": {
    "make_call": 5,
    "send_quendoo_email": 10
  }
}
```

- `maxMessagesPerMinute` (optional): Global message rate limit
- `perToolLimits` (optional): Object with tool-specific limits

**Response:**
```json
{
  "success": true,
  "message": "Rate limits updated successfully"
}
```

**Example:**
```bash
curl -X PUT https://your-backend/admin/security/rate-limits \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxMessagesPerMinute": 25,
    "perToolLimits": {
      "make_call": 3
    }
  }'
```

---

### 6. Disable a Tool

**POST** `/admin/security/tools/disable`

Temporarily disable a tool (e.g., during maintenance).

**Request Body:**
```json
{
  "toolName": "make_call"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tool 'make_call' disabled successfully"
}
```

**Example:**
```bash
curl -X POST https://your-backend/admin/security/tools/disable \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "make_call"
  }'
```

---

### 7. Enable a Tool

**POST** `/admin/security/tools/enable`

Re-enable a previously disabled tool.

**Request Body:**
```json
{
  "toolName": "make_call"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tool 'make_call' enabled successfully"
}
```

---

### 8. Get Security Statistics

**GET** `/admin/security/stats`

Get statistics from all security validators.

**Response:**
```json
{
  "monitor": {
    "totalRequests": 1523,
    "totalBlocked": 45,
    "blockRate": "2.95%"
  },
  "inputValidator": {
    "totalValidations": 1523,
    "blocked": 32,
    "allowed": 1491,
    "blockRate": "2.10%"
  },
  "outputFilter": {
    "totalFilters": 1491,
    "offTopicBlocked": 13,
    "dataRedacted": 5,
    "redactionRate": "0.34%"
  },
  "toolValidator": {
    "totalValidations": 456,
    "allowed": 450,
    "blockedUnknown": 3,
    "blockedRateLimit": 3,
    "blockRate": "1.32%"
  }
}
```

---

### 9. Get Security Events

**GET** `/admin/security/events?limit=20`

Get recent security events with optional filtering.

**Query Parameters:**
- `limit` (optional): Number of events to return (default: 20)

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": "evt_1234567890",
      "timestamp": "2026-01-04T12:34:56.789Z",
      "type": "input_blocked",
      "severity": "warning",
      "conversationId": "conv_abc123",
      "reason": "Potential prompt injection detected",
      "message": "ignore all previous instructions...",
      "action": "blocked"
    },
    {
      "id": "evt_1234567891",
      "timestamp": "2026-01-04T12:35:10.123Z",
      "type": "tool_blocked",
      "severity": "error",
      "conversationId": "conv_def456",
      "reason": "Tool 'unknown_tool' is not in approved tool list",
      "action": "blocked"
    }
  ]
}
```

---

## Common Use Cases

### Use Case 1: Responding to a New Attack Pattern

If you discover a new prompt injection attempt in the logs:

1. **Review the security events:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-backend/admin/security/events?limit=50
   ```

2. **Add the new pattern:**
   ```bash
   curl -X POST https://your-backend/admin/security/injection-patterns/add \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "pattern": "new\\s+attack\\s+pattern",
       "flags": "i"
     }'
   ```

3. **Verify it's active:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-backend/admin/security/config
   ```

---

### Use Case 2: Reducing False Positives

If legitimate hotel queries are being blocked:

1. **Check which keywords triggered the block** (review security events)

2. **Add more hotel-related keywords:**
   ```bash
   curl -X POST https://your-backend/admin/security/hotel-keywords/add \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "keywords": ["spa", "wellness", "amenities"]
     }'
   ```

---

### Use Case 3: Emergency Tool Disable

If a tool is causing issues:

1. **Immediately disable the tool:**
   ```bash
   curl -X POST https://your-backend/admin/security/tools/disable \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "toolName": "problematic_tool"
     }'
   ```

2. **Fix the issue**

3. **Re-enable the tool:**
   ```bash
   curl -X POST https://your-backend/admin/security/tools/enable \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "toolName": "problematic_tool"
     }'
   ```

---

### Use Case 4: Adjusting Rate Limits

If users are hitting rate limits with normal usage:

```bash
curl -X PUT https://your-backend/admin/security/rate-limits \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxMessagesPerMinute": 30,
    "perToolLimits": {
      "send_quendoo_email": 10
    }
  }'
```

---

## Monitoring and Best Practices

### Regular Monitoring

1. **Check statistics daily:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-backend/admin/security/stats
   ```

2. **Review recent events:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-backend/admin/security/events?limit=50
   ```

### Best Practices

1. **Test changes locally** before deploying to production
2. **Monitor logs** after making validation changes
3. **Keep patterns specific** to reduce false positives
4. **Document reasons** for adding new patterns (in code comments or separate docs)
5. **Be conservative** with rate limits (start strict, relax if needed)
6. **Review blocked requests** regularly to identify legitimate use cases

---

## Troubleshooting

### Changes Not Taking Effect

After modifying security rules via the API, the changes are written to the config file. However, you may need to restart the backend server for some changes to take effect:

```bash
# If using PM2
pm2 restart quendoo-backend

# If deployed on Google Cloud Run
gcloud run deploy quendoo-backend --source . --region us-central1
```

### Configuration File Location

The security configuration file is located at:
```
backend/mcp-client/src/security/validationConfig.js
```

You can also manually edit this file if needed, but using the API is recommended for consistency.

---

## Security Considerations

1. **Admin Authentication**: All these endpoints require admin authentication. Keep your admin credentials secure.

2. **Rate Limiting**: The admin endpoints themselves are not rate-limited, but should only be accessed by trusted administrators.

3. **Audit Trail**: All configuration changes should be logged. Consider implementing an audit log for security-critical changes.

4. **Backup**: Before making significant changes, back up your `validationConfig.js` file.

---

## Future Enhancements

Planned features for future versions:

- **Audit logging**: Track all configuration changes with timestamps and admin user
- **Configuration versioning**: Rollback to previous configurations
- **Bulk operations**: Add/remove multiple patterns at once
- **Configuration import/export**: Export configuration as JSON for backups
- **Real-time monitoring**: WebSocket-based live security event stream
- **Pattern testing**: Test new patterns against historical data before deploying

---

## Support

For issues or questions about the Security Management API:
1. Check the logs: `gcloud run services logs read quendoo-backend --region us-central1`
2. Review the security events: `/admin/security/events`
3. Refer to `VALIDATION_RULES.md` for detailed configuration guidance
