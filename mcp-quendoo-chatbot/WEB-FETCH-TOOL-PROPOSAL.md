# Web Fetch Tool - Implementation Proposal

## 🎯 Goal

Добави tool който позволява на Claude да чете информация от URLs (web pages, APIs, документация).

---

## 📋 Use Cases

1. **Проверка на външни цени/наличност**
   - Потребител: "Провери цените на конкурента на booking.com"
   - Claude извиква: `fetch_url("https://booking.com/hotel/xyz")`

2. **Проверка на документация**
   - Потребител: "Какво казва в политиката на cancellation на този link?"
   - Claude извиква: `fetch_url("https://hotel-policy.example.com")`

3. **API интеграции**
   - Потребител: "Провери weather forecast за следващата седмица"
   - Claude извиква: `fetch_url("https://api.weather.com/forecast")`

4. **Проверка на reviews**
   - Потребител: "Какво пишат за нас в TripAdvisor?"
   - Claude извиква: `fetch_url("https://tripadvisor.com/hotel/reviews")`

---

## 🛠️ Implementation

### 1. Add Tool Definition

**Location:** `mcp-quendoo-chatbot/app/quendoo/tools.py`

```python
# Add to QUENDOO_TOOLS list
{
    "name": "fetch_url",
    "description": """Fetch and read content from a URL (web page, API endpoint, or document).

Use this tool when you need to:
- Read information from a specific web URL provided by the user
- Check external websites, APIs, or documentation
- Retrieve data from public endpoints
- Access online resources or pages

The tool will fetch the URL and return:
- For HTML pages: Plain text content (extracted from HTML)
- For JSON APIs: Parsed JSON data
- For text files: Raw text content
- For PDFs: Extracted text (if supported)

Security: Only fetches publicly accessible URLs. Does not support authentication or private pages.""",

    "inputSchema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The URL to fetch. Must be a valid HTTP/HTTPS URL. Examples: https://example.com, https://api.example.com/data",
                "pattern": "^https?://"
            },
            "format": {
                "type": "string",
                "description": "Expected response format: 'html' (default), 'json', 'text', 'pdf'. Used for proper content parsing.",
                "enum": ["html", "json", "text", "pdf"],
                "default": "html"
            },
            "timeout": {
                "type": "integer",
                "description": "Request timeout in seconds (default: 10, max: 30)",
                "minimum": 1,
                "maximum": 30,
                "default": 10
            }
        },
        "required": ["url"]
    }
}
```

---

### 2. Implement Fetch Function

**Location:** `mcp-quendoo-chatbot/app/quendoo/tools.py`

```python
import httpx
from bs4 import BeautifulSoup
from typing import Dict, Any
import json

class WebFetchService:
    """
    Service for fetching and parsing web content
    """

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                'User-Agent': 'QuendooBot/1.0 (Hotel Management Assistant)'
            }
        )

    async def fetch_url(
        self,
        url: str,
        format: str = "html",
        timeout: int = 10
    ) -> Dict[str, Any]:
        """
        Fetch content from a URL and parse based on format

        Args:
            url: URL to fetch
            format: Expected format (html, json, text, pdf)
            timeout: Request timeout in seconds

        Returns:
            Dictionary with:
            - success: bool
            - url: str (original URL)
            - content: str or dict (parsed content)
            - contentType: str (response content-type)
            - statusCode: int
            - error: str (if failed)
        """
        try:
            print(f"[WebFetch] Fetching URL: {url} (format: {format})")

            # Validate URL
            if not url.startswith(('http://', 'https://')):
                return {
                    "success": False,
                    "error": "Invalid URL: must start with http:// or https://"
                }

            # Fetch content
            response = await self.client.get(url, timeout=timeout)
            response.raise_for_status()

            content_type = response.headers.get('content-type', '').lower()

            # Parse based on format
            if format == "json" or "application/json" in content_type:
                try:
                    parsed_content = response.json()
                    return {
                        "success": True,
                        "url": url,
                        "content": parsed_content,
                        "contentType": content_type,
                        "statusCode": response.status_code
                    }
                except json.JSONDecodeError as e:
                    return {
                        "success": False,
                        "error": f"Failed to parse JSON: {str(e)}"
                    }

            elif format == "html" or "text/html" in content_type:
                # Extract text from HTML using BeautifulSoup
                soup = BeautifulSoup(response.text, 'html.parser')

                # Remove script and style elements
                for element in soup(['script', 'style', 'nav', 'footer', 'header']):
                    element.decompose()

                # Get text
                text = soup.get_text(separator='\n', strip=True)

                # Clean up whitespace
                lines = [line.strip() for line in text.splitlines() if line.strip()]
                cleaned_text = '\n'.join(lines)

                # Limit to 10,000 characters to avoid token explosion
                if len(cleaned_text) > 10000:
                    cleaned_text = cleaned_text[:10000] + "\n\n[Content truncated - page was too long]"

                return {
                    "success": True,
                    "url": url,
                    "content": cleaned_text,
                    "contentType": content_type,
                    "statusCode": response.status_code,
                    "title": soup.title.string if soup.title else None
                }

            elif format == "text" or "text/plain" in content_type:
                # Return raw text
                text = response.text

                # Limit to 10,000 characters
                if len(text) > 10000:
                    text = text[:10000] + "\n\n[Content truncated]"

                return {
                    "success": True,
                    "url": url,
                    "content": text,
                    "contentType": content_type,
                    "statusCode": response.status_code
                }

            elif format == "pdf" or "application/pdf" in content_type:
                # TODO: Implement PDF parsing with PyPDF2 or pdfplumber
                return {
                    "success": False,
                    "error": "PDF parsing not yet implemented. Please use HTML or text format."
                }

            else:
                # Unknown format, return as text
                return {
                    "success": True,
                    "url": url,
                    "content": response.text[:10000],
                    "contentType": content_type,
                    "statusCode": response.status_code
                }

        except httpx.TimeoutException:
            return {
                "success": False,
                "error": f"Request timed out after {timeout} seconds"
            }
        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "error": f"HTTP error: {e.response.status_code} {e.response.reason_phrase}",
                "statusCode": e.response.status_code
            }
        except Exception as e:
            print(f"[WebFetch] Error fetching URL: {e}")
            return {
                "success": False,
                "error": f"Failed to fetch URL: {str(e)}"
            }

    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# Global instance
_web_fetch_service = None

def get_web_fetch_service() -> WebFetchService:
    """Get or create WebFetchService singleton"""
    global _web_fetch_service
    if _web_fetch_service is None:
        _web_fetch_service = WebFetchService()
    return _web_fetch_service
```

---

### 3. Add to Tool Executor

**Location:** `mcp-quendoo-chatbot/app/quendoo/tools.py` in `execute_quendoo_tool()`

```python
async def execute_quendoo_tool(tool_name: str, tool_args: Dict[str, Any], api_key: str) -> Dict[str, Any]:
    """Execute a Quendoo tool"""

    # ... existing code ...

    # NEW: Web Fetch tool
    elif tool_name == "fetch_url":
        web_fetch = get_web_fetch_service()
        return await web_fetch.fetch_url(
            url=tool_args.get("url"),
            format=tool_args.get("format", "html"),
            timeout=tool_args.get("timeout", 10)
        )

    # ... rest of code ...
```

---

### 4. Add Dependencies

**Location:** `mcp-quendoo-chatbot/requirements.txt`

```txt
# Add these lines:
httpx==0.27.0
beautifulsoup4==4.12.3
lxml==5.1.0
```

---

### 5. Update System Prompt (Optional)

**Location:** `backend/mcp-client/src/systemPrompts.js`

```javascript
// Add guidance for web fetch tool
You have access to a \`fetch_url\` tool that can read content from web URLs.

Use this tool when:
- User provides a specific URL to check
- User asks about external websites or documentation
- You need to verify information from an online source

Example usage:
- "Check what this link says" → fetch_url(url)
- "What are the reviews on this page?" → fetch_url(url)

IMPORTANT:
- Only fetch URLs explicitly provided by the user
- Do not fetch random URLs without user permission
- Content is limited to 10,000 characters
- Timeout is 10 seconds by default
```

---

## 🔒 Security Considerations

### 1. Rate Limiting

Добави rate limiting за да предотвратиш abuse:

```python
from collections import defaultdict
from datetime import datetime, timedelta

class RateLimiter:
    def __init__(self, max_requests=10, window_minutes=1):
        self.max_requests = max_requests
        self.window = timedelta(minutes=window_minutes)
        self.requests = defaultdict(list)

    def check_limit(self, key: str) -> bool:
        now = datetime.now()
        # Clean old requests
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if now - req_time < self.window
        ]

        # Check limit
        if len(self.requests[key]) >= self.max_requests:
            return False

        # Add request
        self.requests[key].append(now)
        return True

# Usage in fetch_url
rate_limiter = RateLimiter(max_requests=10, window_minutes=1)

async def fetch_url(self, url: str, ...):
    # Check rate limit by hotel
    if not rate_limiter.check_limit(api_key):
        return {
            "success": False,
            "error": "Rate limit exceeded. Maximum 10 requests per minute."
        }
    # ... rest of code
```

### 2. URL Whitelist/Blacklist

```python
# Blacklist suspicious domains
BLACKLISTED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '192.168.',
    '10.',
    '172.16.'
]

def is_url_safe(url: str) -> bool:
    """Check if URL is safe to fetch"""
    from urllib.parse import urlparse

    parsed = urlparse(url)

    # Check blacklist
    for blocked in BLACKLISTED_DOMAINS:
        if blocked in parsed.netloc.lower():
            return False

    return True

# In fetch_url:
if not is_url_safe(url):
    return {
        "success": False,
        "error": "URL is not allowed (local/private network)"
    }
```

### 3. Content Size Limit

Вече имплементирано - 10,000 characters limit

### 4. Timeout Protection

Вече имплементирано - 30s max timeout

---

## 📊 Expected Token Usage

**Per web page fetch:**
- URL: ~10 tokens
- Average content: ~2,500 tokens (10,000 chars / 4)
- Result metadata: ~50 tokens
- **Total: ~2,600 tokens per fetch**

**Impact on conversation:**
- With 12-message history: ~7,300 tokens
- After 1 web fetch: ~9,900 tokens (still < 5% of 200K limit) ✅
- After 3 web fetches: ~15,100 tokens (~7.5% of limit) ✅

**Safe usage: Up to 5-10 web fetches per conversation**

---

## 🧪 Testing

```python
# Test script: test-web-fetch.py
import asyncio
from app.quendoo.tools import get_web_fetch_service

async def test_fetch():
    service = get_web_fetch_service()

    # Test 1: HTML page
    result1 = await service.fetch_url(
        "https://example.com",
        format="html"
    )
    print("HTML Test:", result1["success"])
    print("Content preview:", result1["content"][:200])

    # Test 2: JSON API
    result2 = await service.fetch_url(
        "https://api.github.com/repos/anthropics/anthropic-sdk-python",
        format="json"
    )
    print("\nJSON Test:", result2["success"])
    print("Stars:", result2["content"].get("stargazers_count"))

    # Test 3: Invalid URL
    result3 = await service.fetch_url(
        "http://localhost:8080",
        format="html"
    )
    print("\nInvalid URL Test:", result3["success"], result3.get("error"))

    await service.close()

asyncio.run(test_fetch())
```

---

## 🚀 Deployment Steps

1. **Update requirements.txt** - Add httpx, beautifulsoup4, lxml
2. **Add tool definition** - QUENDOO_TOOLS in tools.py
3. **Implement WebFetchService** - Class with fetch_url method
4. **Add to executor** - execute_quendoo_tool() case
5. **Deploy MCP server** - `gcloud run deploy mcp-quendoo-chatbot`
6. **Test in chat** - Ask Claude to fetch a URL

---

## ✅ Success Criteria

After implementation:
- ✅ Claude can fetch and read HTML pages
- ✅ Claude can fetch JSON APIs
- ✅ Rate limiting prevents abuse (10 req/min)
- ✅ Private/local URLs are blocked
- ✅ Content is truncated to prevent token explosion
- ✅ Error handling for timeouts, 404s, etc.

---

## 📝 Example Usage

**User:** "Провери какво казва в този линк: https://example.com/hotel-policy"

**Claude:** "Ще проверя линка."
```
Tool: fetch_url
Params: { "url": "https://example.com/hotel-policy", "format": "html" }
Result: {
  "success": true,
  "content": "Hotel Policy\n\nCancellation Policy:\n- Free cancellation up to 24 hours before check-in\n- 50% charge for cancellations within 24 hours\n..."
}
```

**Claude Response:** "Според политиката на хотела в линка:

**Cancellation Policy:**
- Безплатна отмяна до 24 часа преди настаняване
- 50% такса при отмяна в рамките на 24 часа

Пълната политика можеш да видиш на [example.com/hotel-policy](https://example.com/hotel-policy)."

---

Искаш ли да започна implementation? 🚀
