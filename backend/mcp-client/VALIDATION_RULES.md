# Validation Rules Configuration Guide

This guide explains how to adjust security validation rules without modifying core code.

## Configuration File

All validation rules are centralized in: `src/security/validationConfig.js`

## Common Adjustments

### 1. Disable a Tool Temporarily

To disable a tool (e.g., during maintenance), add it to the `disabledTools` array:

```javascript
disabledTools: [
  'make_call'  // This tool will be blocked
]
```

### 2. Add New Prompt Injection Patterns

If you discover a new bypass attempt, add it to `injectionPatterns`:

```javascript
injectionPatterns: [
  // ... existing patterns
  /your\s+new\s+pattern/i  // Add your pattern here
]
```

### 3. Add Custom Tool Parameter Validation

For complex parameter validation (like `update_availability`), add a validator function:

```javascript
parameterRules: {
  'your_tool_name': {
    validateYourParam: (paramValue) => {
      // Your validation logic
      if (/* invalid condition */) {
        return { valid: false, reason: 'Error message' };
      }
      return { valid: true };
    }
  }
}
```

**Example:** The `update_availability` validator checks that:
- `values` is an array
- Each object has required fields: `date`, `room_id`, `avail`, `qty`, `is_opened`
- Date format is `YYYY-MM-DD`

### 4. Adjust Rate Limits

Change conversation or per-tool rate limits:

```javascript
rateLimits: {
  maxMessagesPerMinute: 20,  // Global limit

  perToolLimits: {
    'make_call': 3,  // Tool-specific limit
    'your_tool': 10
  }
}
```

### 5. Add Off-Topic Detection Keywords

To detect new off-topic categories, add keywords:

```javascript
offTopicKeywords: {
  yourCategory: [
    'keyword1', 'keyword2', 'keyword3'
  ]
}
```

### 6. Add Hotel Keywords (Reduce False Positives)

If legitimate hotel queries are being blocked, add more hotel-related keywords:

```javascript
hotelKeywords: [
  // ... existing keywords
  'new_hotel_term', 'another_term'
]
```

## Testing Validation Changes

After modifying `validationConfig.js`:

1. **Test locally:**
   ```bash
   cd backend/mcp-client
   npm start
   ```

2. **Send test messages** to verify validation works correctly

3. **Check logs** for validation events:
   ```bash
   gcloud run services logs read quendoo-backend --region us-central1 --limit 50
   ```

4. **Deploy to production:**
   ```bash
   gcloud run deploy quendoo-backend --source . --region us-central1 --allow-unauthenticated
   ```

## Monitoring Validation

### View Security Stats

Visit the admin security dashboard: `https://quendoo-ai-dashboard.web.app/admin/security`

### Check Backend Logs

```bash
# View recent logs
gcloud run services logs read quendoo-backend --region us-central1 --limit 100

# Search for specific events
gcloud run services logs read quendoo-backend --region us-central1 | findstr "Security"
```

### Key Log Messages

- `[Security] Blocked unknown tool:` - Tool not in allowlist
- `[Security] Custom validation failed:` - Parameter validation failed
- `[Security] Rate limit exceeded:` - Too many requests
- `[Security] Response replaced:` - Off-topic response filtered

## Common Issues

### Tool Blocked Unexpectedly

**Problem:** Legitimate tool calls are being blocked

**Solution:** Check if:
1. Tool is in `disabledTools` array (remove it)
2. Required parameters are missing (check tool definition in `toolValidator.js`)
3. Custom validator is too strict (adjust in `validationConfig.js`)

### False Positives in Off-Topic Detection

**Problem:** Legitimate hotel questions are being blocked

**Solution:**
1. Add more `hotelKeywords` to reduce false positives
2. Remove overly broad keywords from `offTopicKeywords`
3. Check validation logic in `inputValidator.js`

### Rate Limit Too Strict

**Problem:** Users hitting rate limits with normal usage

**Solution:** Increase limits in `validationConfig.js`:

```javascript
rateLimits: {
  maxMessagesPerMinute: 30,  // Increase from 20
  perToolLimits: {
    'affected_tool': 15  // Increase tool limit
  }
}
```

## Emergency Rollback

If validation changes cause issues:

```bash
# Rollback to previous deployment
gcloud run services update-traffic quendoo-backend \
  --to-revisions=PREVIOUS_REVISION=100
```

Find previous revisions:
```bash
gcloud run revisions list --service=quendoo-backend --region=us-central1
```

## Best Practices

1. **Test changes locally** before deploying
2. **Monitor logs** after deploying validation changes
3. **Document reasons** for validation rules in comments
4. **Be conservative** with rate limits (start strict, relax if needed)
5. **Keep patterns specific** to reduce false positives
6. **Add examples** in comments for complex validation rules

## System Prompt Tool Documentation

The system prompt now includes tool documentation to help Claude format parameters correctly. If you add new tools or change parameter requirements:

1. Update tool definitions in `src/security/toolValidator.js`
2. Update tool documentation in `src/systemPrompts.js`
3. Add custom validators in `src/security/validationConfig.js` if needed

This ensures Claude knows how to call tools properly and validation catches incorrect usage.
