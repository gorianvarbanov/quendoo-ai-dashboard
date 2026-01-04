# Security Configuration UI Guide

This guide explains how to use the **Security Configuration** page in the Quendoo Admin Panel to manage security rules without editing code files.

## Accessing the Security Configuration

1. Log in to the admin panel at `/admin/login`
2. Navigate to **Security Config** from the sidebar menu
3. Or click **Security Configuration** from the dashboard Quick Actions

## Available Security Management Features

### 1. Injection Patterns

**Purpose:** Define regex patterns that detect prompt injection attempts.

**How to Add:**
1. Scroll to the **Injection Patterns** card
2. Enter a regex pattern in the text field (e.g., `bypass\\s+security`)
3. Select regex flags (default: `i` for case-insensitive)
4. Click **Add Pattern**

**Example Patterns:**
- `ignore\\s+previous\\s+instructions` - Detects "ignore previous instructions"
- `you\\s+are\\s+now\\s+a` - Detects role-switching attempts
- `<\\s*script` - Detects HTML injection attempts

**Current Patterns:** View all active injection patterns in the list above the add form.

---

### 2. Off-Topic Keywords

**Purpose:** Define keywords that trigger detection of queries unrelated to hotel operations.

**Categories:**
- **medical** - Medical advice, treatments, medications
- **cooking** - Recipes, food preparation
- **programming** - Code, software development
- **gardening** - Plants, flowers, landscaping

**How to Add:**
1. Scroll to the **Off-Topic Keywords** card
2. Select a category from the dropdown
3. Type keywords and press Enter (you can add multiple)
4. Click **Add Keywords**

**Example Keywords:**
- Medical: `diagnosis`, `prescription`, `treatment`, `symptom`
- Cooking: `recipe`, `ingredient`, `bake`, `cook`
- Programming: `python`, `javascript`, `code`, `function`

**View Current Keywords:** Expand any category to see all keywords in that category.

---

### 3. Hotel Keywords

**Purpose:** Keywords that reduce false positives by indicating legitimate hotel-related queries.

**How to Add:**
1. Scroll to the **Hotel Keywords** card
2. Type hotel-related keywords and press Enter (you can add multiple)
3. Click **Add Hotel Keywords**

**Example Keywords:**
- `suite`, `accommodation`, `lodge`, `resort`
- `concierge`, `amenities`, `housekeeping`
- `check-in`, `check-out`, `front desk`

**Why This Matters:** If a user mentions "room service" but the system detects the word "service" as programming-related, having "room" as a hotel keyword prevents false blocking.

---

### 4. Rate Limits

**Purpose:** Control how many messages and tool calls are allowed per minute to prevent abuse and DoS attacks.

**Settings:**
1. **Max Messages Per Minute**: Global limit for all conversations (default: 20)
2. **Per-Tool Limits**: Specific limits for individual tools

**How to Update:**
1. Scroll to the **Rate Limits** card
2. Adjust the "Max Messages Per Minute" value
3. Modify per-tool limits for specific tools (e.g., `make_call`: 3/min)
4. Click **Update Rate Limits**

**Recommended Limits:**
- `make_call`: 3-5 per minute (phone calls are expensive)
- `send_quendoo_email`: 5-10 per minute (prevent email spam)
- General messages: 20-30 per minute (balance usability and protection)

---

### 5. Tool Management

**Purpose:** Temporarily disable problematic tools during maintenance or emergencies.

**How to Disable a Tool:**
1. Scroll to the **Tool Management** card
2. Enter the tool name (e.g., `make_call`)
3. Click **Disable Tool**

**How to Enable a Tool:**
- Click the X button on any disabled tool chip to re-enable it

**Use Cases:**
- **Emergency Disable**: Tool is causing errors or costs
- **Maintenance**: Tool backend is down for maintenance
- **Testing**: Temporarily disable tools to test fallback behavior

---

### 6. Configuration Info

**Purpose:** Overview of current security configuration status.

**Displays:**
- Total number of injection patterns
- Number of off-topic categories
- Total hotel keywords
- Number of disabled tools
- Current message rate limit

**Status Indicators:** Color-coded chips show counts for quick reference.

---

## Real-Time Updates

All changes take effect **immediately** after saving:
- Backend server updates its configuration in real-time
- No server restart required
- Changes are persisted to the configuration file

---

## Common Workflows

### Workflow 1: Responding to a New Attack Pattern

**Scenario:** You notice a new prompt injection attempt in the Security Monitor.

**Steps:**
1. Go to **Security Monitor** to view recent security events
2. Identify the attack pattern from the blocked message
3. Go to **Security Config** → **Injection Patterns**
4. Add a new regex pattern matching the attack
5. Verify it appears in the pattern list
6. Return to **Security Monitor** to confirm future blocks

---

### Workflow 2: Reducing False Positives

**Scenario:** Legitimate hotel queries are being blocked as off-topic.

**Steps:**
1. Go to **Security Monitor** to see what was blocked
2. Identify which keyword triggered the false positive
3. Go to **Security Config** → **Hotel Keywords**
4. Add the hotel-related keywords from the blocked query
5. Test a similar query to verify it now passes

---

### Workflow 3: Emergency Tool Disable

**Scenario:** The `make_call` tool is causing billing issues.

**Steps:**
1. Go to **Security Config** → **Tool Management**
2. Enter `make_call` in the tool name field
3. Click **Disable Tool**
4. Verify the tool appears in the "Disabled Tools" list
5. Fix the underlying issue
6. Click the X on the disabled tool chip to re-enable

---

### Workflow 4: Adjusting Rate Limits

**Scenario:** Users are hitting rate limits with normal usage.

**Steps:**
1. Go to **Security Monitor** to check rate limit events
2. Determine which limit is too strict
3. Go to **Security Config** → **Rate Limits**
4. Increase the appropriate limit (global or per-tool)
5. Click **Update Rate Limits**
6. Monitor Security Monitor to verify users are no longer blocked

---

## Best Practices

### Pattern Design
- **Be Specific**: Avoid overly broad patterns that may cause false positives
- **Test First**: Test patterns with sample inputs before deploying
- **Document**: Add comments in the code explaining why each pattern was added

### Keyword Management
- **Start Conservative**: Begin with known problematic keywords
- **Monitor Logs**: Regularly review security events to find new patterns
- **Balance**: Too many hotel keywords may allow attacks; too few causes false positives

### Rate Limiting
- **Start Strict**: Begin with low limits and increase based on usage
- **Tool-Specific**: Set lower limits for expensive operations (calls, emails)
- **Monitor Impact**: Track legitimate users hitting limits

### Tool Disabling
- **Temporary Only**: Use for emergencies, not long-term solutions
- **Document Why**: Note why a tool was disabled for future reference
- **Re-Enable ASAP**: Restore functionality as soon as issues are resolved

---

## Troubleshooting

### "Failed to load security configuration"
**Cause:** Authentication token expired or network issue
**Fix:** Log out and log back in

### Changes Not Taking Effect
**Cause:** Browser cache or timing issue
**Fix:**
1. Refresh the Security Config page
2. Check that the change appears in the configuration
3. Test with a new conversation (not cached)

### Cannot Add Pattern
**Cause:** Invalid regex syntax
**Fix:** Test your regex pattern before adding (use https://regex101.com)

### Tool Still Executing After Disable
**Cause:** Cached request or timing issue
**Fix:**
1. Refresh the Security Config page to verify tool is in disabled list
2. Start a new conversation to test
3. If still fails, contact developer

---

## API Access

For advanced users, all UI functions are available via REST API. See [SECURITY_API_GUIDE.md](./SECURITY_API_GUIDE.md) for details.

---

## Support

For issues with the Security Configuration UI:
1. Check browser console for error messages
2. Verify you're logged in as admin
3. Review Security Monitor for related events
4. Check [SECURITY_API_GUIDE.md](./SECURITY_API_GUIDE.md) for API details

For security-related questions:
- Review [VALIDATION_RULES.md](./VALIDATION_RULES.md) for rule explanations
- Check [SECURITY_API_GUIDE.md](./SECURITY_API_GUIDE.md) for advanced usage
