"""
Quendoo tool implementations - all tools from existing MCP server

Tools are called with tenant's API key to ensure proper isolation
"""
from typing import Dict, Any
import os
import httpx
from bs4 import BeautifulSoup
from collections import defaultdict
from datetime import datetime, timedelta
from urllib.parse import urlparse
from app.quendoo.client import QuendooAPIClient


# Tool definitions with schemas
QUENDOO_TOOLS = [
    {
        "name": "get_property_settings",
        "description": "Get property settings including rooms, rates, services, meals, beds, booking modules, payment methods, and channel codes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "api_lng": {
                    "type": "string",
                    "description": "Language code (e.g., 'en', 'bg'). Optional."
                },
                "names": {
                    "type": "string",
                    "description": "Comma-separated list of setting names to retrieve. Optional."
                }
            }
        }
    },
    {
        "name": "get_rooms_details",
        "description": "Get detailed information about room TYPES (not availability). Returns room type properties: room name, room ID, room size (sq meters), bed configurations, maximum occupancy, amenities, and descriptions. Use this tool when you need to describe what types of rooms the hotel has. DO NOT use for checking availability or booking - use get_availability or get_booking_offers instead.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "api_lng": {
                    "type": "string",
                    "description": "Language code for room details (e.g., 'en', 'bg'). Optional."
                },
                "room_id": {
                    "type": "integer",
                    "description": "Specific room type ID to get details for. Optional (returns all room types if omitted)."
                }
            }
        }
    },
    {
        "name": "get_availability",
        "description": "Get availability for a date range and system (qdo or ext).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "date_from": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format"
                },
                "date_to": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format"
                },
                "sysres": {
                    "type": "string",
                    "description": "System reservation type ('qdo' for Quendoo or 'ext' for external)"
                }
            },
            "required": ["date_from", "date_to", "sysres"]
        }
    },
    {
        "name": "update_availability",
        "description": "Update availability values for rooms or external rooms.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "values": {
                    "type": "array",
                    "description": "List of availability updates, each containing: date, room_id or ext_room_id, avail",
                    "items": {
                        "type": "object"
                    }
                }
            },
            "required": ["values"]
        }
    },
    {
        "name": "get_bookings",
        "description": "List all bookings for the property.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_booking_offers",
        "description": "PRIMARY TOOL FOR OFFERS AND PRICES. Use when user asks for offers, prices, 'колко струва', 'дай оферта'. Returns available rooms with prices and availability. DO NOT combine with get_rooms_details or get_property_settings - this tool gives you everything you need for pricing queries.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "date_from": {
                    "type": "string",
                    "description": "Check-in date in YYYY-MM-DD format. MUST ask user if not provided."
                },
                "nights": {
                    "type": "integer",
                    "description": "Number of nights for the stay. MUST ask user if not provided."
                },
                "guests": {
                    "type": "array",
                    "description": "List of guest objects with format [{\"adults\": 2, \"children_by_ages\": [5, 8]}]. REQUIRED - ask user 'How many adults and children?' if not provided.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "adults": {
                                "type": "integer",
                                "description": "Number of adults in this room"
                            },
                            "children_by_ages": {
                                "type": "array",
                                "description": "Ages of children (empty array if no children)",
                                "items": {
                                    "type": "integer"
                                }
                            }
                        },
                        "required": ["adults", "children_by_ages"]
                    }
                },
                "bm_code": {
                    "type": "string",
                    "description": "Booking module code (e.g., 'neXu98qdmw'). If not provided, uses first active module. Optional."
                },
                "api_lng": {
                    "type": "string",
                    "description": "Language code. Optional."
                },
                "currency": {
                    "type": "string",
                    "description": "Currency code (e.g., 'BGN', 'EUR', 'USD'). Optional."
                }
            },
            "required": ["date_from", "nights", "guests"]
        }
    },
    {
        "name": "ack_booking",
        "description": "Acknowledge a booking using booking_id and revision_id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "booking_id": {
                    "type": "integer",
                    "description": "Booking ID"
                },
                "revision_id": {
                    "type": "string",
                    "description": "Revision ID"
                }
            },
            "required": ["booking_id", "revision_id"]
        }
    },
    {
        "name": "post_room_assignment",
        "description": "Send room assignment for a booking.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "booking_id": {
                    "type": "integer",
                    "description": "Booking ID"
                },
                "revision_id": {
                    "type": "string",
                    "description": "Revision ID"
                }
            },
            "required": ["booking_id", "revision_id"]
        }
    },
    {
        "name": "post_external_property_data",
        "description": "Send external property mapping data to Quendoo.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "data": {
                    "type": "object",
                    "description": "External property data object"
                }
            },
            "required": ["data"]
        }
    },
    {
        "name": "make_call",
        "description": "Initiate a voice call with a spoken message using Quendoo automation service. IMPORTANT: Choose the language parameter intelligently based on context: (1) If user explicitly requests a language ('call in Russian', 'обади се на немски'), use that language. (2) If calling a guest/client, infer their language from their name, nationality, booking notes, or country code. (3) Otherwise, use the hotel's default language. Use native accent - bg-BG for Bulgarian native speaker, ru-RU for Russian native speaker, NOT English accent reading foreign text.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "phone": {
                    "type": "string",
                    "description": "Phone number to call (international format recommended)"
                },
                "message": {
                    "type": "string",
                    "description": "Message to speak during the call (in the target language)"
                },
                "language": {
                    "type": "string",
                    "description": "TTS language code: bg-BG (Bulgarian), de-DE (German), ru-RU (Russian), en-US (English), fr-FR (French), es-ES (Spanish), it-IT (Italian), tr-TR (Turkish), ro-RO (Romanian), pl-PL (Polish), cs-CZ (Czech), el-GR (Greek), nl-NL (Dutch), pt-PT (Portuguese), sv-SE (Swedish), da-DK (Danish), fi-FI (Finnish), no-NO (Norwegian), uk-UA (Ukrainian), ar-XA (Arabic). Choose based on who you're calling.",
                    "default": "bg-BG"
                }
            },
            "required": ["phone", "message"]
        }
    },
    {
        "name": "send_quendoo_email",
        "description": "Send an email via Quendoo email service. Supports both plain text and HTML content. Set html=true to send HTML formatted emails.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "to": {
                    "type": "string",
                    "description": "Recipient email address"
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line"
                },
                "message": {
                    "type": "string",
                    "description": "Email body content. If html=true, this should be valid HTML markup."
                },
                "html": {
                    "type": "boolean",
                    "description": "Set to true to send HTML formatted email. Default is false (plain text).",
                    "default": False
                }
            },
            "required": ["to", "subject", "message"]
        }
    },
    {
        "name": "search_hotel_documents",
        "description": "Search hotel documents using semantic search. Use this to find information in uploaded hotel documents (policies, procedures, manuals, etc.). Returns relevant excerpts from documents that match the query.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language search query (e.g., 'What is the cancellation policy?', 'Hotel breakfast times')"
                },
                "documentTypes": {
                    "type": "array",
                    "description": "Optional filter by document types (e.g., ['policy', 'procedure', 'manual']). Leave empty to search all documents.",
                    "items": {
                        "type": "string"
                    }
                },
                "topK": {
                    "type": "integer",
                    "description": "Number of results to return (1-10). Default is 3.",
                    "minimum": 1,
                    "maximum": 10
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "list_hotel_documents",
        "description": "List all uploaded hotel documents with metadata. Use this to see what documents are available for the hotel.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "documentTypes": {
                    "type": "array",
                    "description": "Optional filter by document types (e.g., ['policy', 'procedure', 'manual']). Leave empty to list all documents.",
                    "items": {
                        "type": "string"
                    }
                }
            }
        }
    },
    {
        "name": "fetch_url",
        "description": """Fetch and read content from a web URL (webpage, API endpoint, or document).

Use this tool when you need to:
- Read information from a specific web URL provided by the user
- Check external websites, documentation, or policies
- Retrieve data from public APIs or endpoints
- Access online resources, reviews, or content
- Verify information from external sources

The tool will fetch the URL and return:
- For HTML pages: Clean text content (extracted from HTML, without scripts/styles)
- For JSON APIs: Parsed JSON data structure
- For text files: Raw text content

Important limitations:
- Only publicly accessible URLs (no authentication)
- Content limited to 10,000 characters to prevent token overflow
- Maximum 10 requests per minute per hotel (rate limited)
- Timeout: 30 seconds maximum
- Private/local network URLs are blocked for security

Security: This tool does NOT support authentication, cookies, or access to private pages. It only fetches public content.""",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The complete URL to fetch. Must start with http:// or https://. Examples: 'https://example.com', 'https://api.example.com/data', 'https://docs.example.com/policy.html'",
                    "pattern": "^https?://"
                },
                "format": {
                    "type": "string",
                    "description": "Expected response format for proper parsing. Options: 'html' (default - extracts text from HTML pages), 'json' (parses JSON APIs), 'text' (raw text content). If not specified, auto-detects based on Content-Type header.",
                    "enum": ["html", "json", "text"],
                    "default": "html"
                },
                "timeout": {
                    "type": "integer",
                    "description": "Request timeout in seconds. Default: 10, minimum: 1, maximum: 30. Increase for slow servers.",
                    "minimum": 1,
                    "maximum": 30,
                    "default": 10
                }
            },
            "required": ["url"]
        }
    },
    {
        "name": "analyze_data",
        "description": """Analyze data using Claude AI and return formatted results based on specific criteria.

Use this tool to:
- Filter and analyze data from previous tool results
- Format data according to specific requirements
- Generate summaries and insights from raw data
- Apply business logic and calculations

Example use cases:
- "Find dates with less than 5 available rooms"
- "Calculate average occupancy for the month"
- "Identify peak booking periods"
- "Compare availability across room types"

This tool takes the data from the previous step (using {RESULT} placeholder) and applies intelligent analysis using Claude AI.""",
        "inputSchema": {
            "type": "object",
            "properties": {
                "data": {
                    "type": "string",
                    "description": "The data to analyze (usually from previous step using {RESULT} placeholder)"
                },
                "instruction": {
                    "type": "string",
                    "description": "Natural language instruction for what analysis to perform. Examples: 'Show only dates with less than 5 available rooms', 'Calculate total availability per room type', 'Find the busiest week'"
                },
                "format": {
                    "type": "string",
                    "description": "Desired output format: 'text' (human-readable summary), 'json' (structured data), 'table' (markdown table), 'html_table' (HTML table for emails), 'list' (bulleted list). Default: 'text'",
                    "enum": ["text", "json", "table", "html_table", "list"],
                    "default": "text"
                }
            },
            "required": ["data", "instruction"]
        }
    },
    {
        "name": "query_excel_data",
        "description": """Query structured data from uploaded Excel files with intelligent filtering, sorting, and value extraction.

Use this tool when users ask for SPECIFIC VALUES or NUMERIC QUERIES from Excel files:
- Exact record lookups: "резервация 442231", "покажи номер 43"
- Numeric ranges: "номера над 400000", "резервации между 100-200", "цени под 500 лв"
- Min/Max values: "най-високи 3 номера", "най-ниски цени", "максимална цена"
- Sorted results: "покажи топ 10 резервации", "сортирай по дата"
- Specific field values: "всички резервации за януари", "гости от Sofia"

This tool works directly with the structured Excel data (spreadsheet cells) and supports:
- Exact value matching (IDs, names, numbers)
- Numeric comparisons (greater than, less than, between)
- Sorting by any column (ascending/descending for min/max)
- Pattern matching (contains, starts with, date ranges)
- Returns actual row data with all fields

IMPORTANT: Use this tool instead of search_hotel_documents when:
✅ Query mentions specific numbers or IDs
✅ Query asks for highest/lowest/top/bottom values
✅ Query asks for ranges or comparisons
✅ User wants sorted or filtered Excel data

Use search_hotel_documents instead when:
❌ Query is about text content/meaning ("какви са условията?")
❌ Query is semantic ("политика за отказ", "процедури")

Examples:
- "най-високи номера на резервации" → query_excel_data (numeric sort)
- "резервация 442231" → query_excel_data (exact match)
- "резервации над 400000" → query_excel_data (numeric filter)
- "условия за cancellation" → search_hotel_documents (semantic)""",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language query describing what to find in Excel files. Examples: 'най-високи 3 номера на резервации', 'резервация номер 442231', 'всички резервации за януари 2026', 'цени над 500 лв', 'покажи топ 5 по цена'"
                },
                "fileName": {
                    "type": "string",
                    "description": "Optional: specific Excel filename to query (e.g., 'export-2026.xlsx'). If omitted, searches all Excel files in the hotel's documents."
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return. Default: 10 for lists, 3 for top/bottom queries, 1 for specific ID lookups.",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 10
                }
            },
            "required": ["query"]
        }
    }
]


# Automation client for make_call
class AutomationClient:
    """HTTP client for Quendoo Cloud Automation functions."""

    DEFAULT_BASE_URL = "https://us-central1-quednoo-chatgtp-mailing.cloudfunctions.net"

    def __init__(self):
        self.base_url = os.getenv("QUENDOO_AUTOMATION_BASE_URL", self.DEFAULT_BASE_URL).rstrip("/")
        self.bearer_token = os.getenv("QUENDOO_AUTOMATION_BEARER")

    async def make_call(self, phone: str, message: str, language: str = "en-US") -> Dict[str, Any]:
        """Make a voice call with spoken message."""
        if not self.bearer_token:
            raise ValueError("QUENDOO_AUTOMATION_BEARER environment variable is not set")

        url = f"{self.base_url}/make_call"
        headers = {
            "Authorization": f"Bearer {self.bearer_token}",
            "Content-Type": "application/json"
        }
        payload = {"phone": phone, "message": message, "language": language}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json() if resp.content else {"status": resp.status_code}
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Automation request failed with status {exc.response.status_code}: {exc.response.text}"
            ) from exc


# Helper function to convert markdown table to HTML
def markdown_table_to_html(markdown_table: str) -> str:
    """Convert a markdown table to a styled HTML table.

    Args:
        markdown_table: Markdown formatted table string

    Returns:
        HTML formatted table with inline CSS styling
    """
    lines = markdown_table.strip().split('\n')
    if len(lines) < 2:
        return markdown_table  # Not a table

    html = ['<table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">']

    # Process header row
    headers = [cell.strip() for cell in lines[0].split('|')[1:-1]]  # Remove empty first/last
    html.append('  <thead>')
    html.append('    <tr style="background-color: #4CAF50; color: white;">')
    for header in headers:
        html.append(f'      <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">{header}</th>')
    html.append('    </tr>')
    html.append('  </thead>')

    # Skip separator line (line 1)
    # Process data rows
    html.append('  <tbody>')
    for i, line in enumerate(lines[2:]):
        cells = [cell.strip() for cell in line.split('|')[1:-1]]
        row_style = 'background-color: #f2f2f2;' if i % 2 == 0 else 'background-color: white;'
        html.append(f'    <tr style="{row_style}">')
        for cell in cells:
            html.append(f'      <td style="border: 1px solid #ddd; padding: 8px;">{cell}</td>')
        html.append('    </tr>')
    html.append('  </tbody>')

    html.append('</table>')
    return '\n'.join(html)


# Email client for send_quendoo_email
class EmailClient:
    """HTTP client for sending emails via Quendoo email service."""

    EMAIL_SERVICE_URL = "https://us-central1-quednoo-chatgtp-mailing.cloudfunctions.net/send_quendoo_email"

    def __init__(self):
        self.api_key = os.getenv("EMAIL_API_KEY")

    async def send_email(self, to: str, subject: str, message: str, html: bool = False) -> Dict[str, Any]:
        """Send an email via the Quendoo email cloud function.

        Args:
            to: Recipient email address
            subject: Email subject line
            message: Email body content (HTML if html=True, plain text otherwise)
            html: If True, send as HTML email. If False, send as plain text.
        """
        if not self.api_key:
            raise ValueError("EMAIL_API_KEY environment variable is not set")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "to": to,
            "subject": subject,
            "message": message,
            "html": html  # Pass HTML flag to email service
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.EMAIL_SERVICE_URL, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Email request failed with status {exc.response.status_code}: {exc.response.text}"
            ) from exc


# Rate limiter for web fetch
class RateLimiter:
    """Simple rate limiter to prevent abuse"""
    def __init__(self, max_requests=10, window_minutes=1):
        self.max_requests = max_requests
        self.window = timedelta(minutes=window_minutes)
        self.requests = defaultdict(list)

    def check_limit(self, key: str) -> bool:
        """Check if key is within rate limit"""
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


# Web fetch client
class WebFetchService:
    """
    Service for fetching and parsing web content
    Supports HTML, JSON, and plain text formats
    """

    # Blacklist for security
    BLACKLISTED_DOMAINS = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '192.168.',
        '10.',
        '172.16.',
        '169.254.'  # Link-local
    ]

    def __init__(self):
        self.rate_limiter = RateLimiter(max_requests=10, window_minutes=1)

    def is_url_safe(self, url: str) -> tuple[bool, str]:
        """Check if URL is safe to fetch"""
        try:
            parsed = urlparse(url)

            # Must have scheme
            if parsed.scheme not in ['http', 'https']:
                return False, "Only HTTP/HTTPS URLs are allowed"

            # Check blacklist
            for blocked in self.BLACKLISTED_DOMAINS:
                if blocked in parsed.netloc.lower():
                    return False, "Private/local network URLs are not allowed"

            return True, ""
        except Exception as e:
            return False, f"Invalid URL: {str(e)}"

    async def fetch_url(
        self,
        url: str,
        format: str = "html",
        timeout: int = 10,
        api_key: str = None
    ) -> Dict[str, Any]:
        """
        Fetch content from a URL and parse based on format

        Args:
            url: URL to fetch
            format: Expected format (html, json, text)
            timeout: Request timeout in seconds
            api_key: API key for rate limiting (optional)

        Returns:
            Dictionary with success, content, metadata, or error
        """
        try:
            print(f"[WebFetch] Fetching URL: {url} (format: {format})")

            # Rate limiting
            rate_key = api_key or "default"
            if not self.rate_limiter.check_limit(rate_key):
                return {
                    "success": False,
                    "error": "Rate limit exceeded. Maximum 10 requests per minute."
                }

            # Security check
            is_safe, error_msg = self.is_url_safe(url)
            if not is_safe:
                return {
                    "success": False,
                    "error": error_msg
                }

            # Validate timeout
            timeout = max(1, min(timeout, 30))

            # Fetch content
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                headers={
                    'User-Agent': 'QuendooBot/1.0 (Hotel Management Assistant)'
                }
            ) as client:
                response = await client.get(url)
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
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Failed to parse JSON: {str(e)}"
                    }

            elif format == "html" or "text/html" in content_type:
                # Extract text from HTML using BeautifulSoup
                soup = BeautifulSoup(response.text, 'html.parser')

                # Remove script and style elements
                for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
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

            else:
                # Unknown format, try to return as text
                text = response.text[:10000]
                return {
                    "success": True,
                    "url": url,
                    "content": text,
                    "contentType": content_type,
                    "statusCode": response.status_code,
                    "warning": f"Unknown content type: {content_type}"
                }

        except httpx.TimeoutException:
            return {
                "success": False,
                "error": f"Request timed out after {timeout} seconds"
            }
        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "error": f"HTTP error: {e.response.status_code}",
                "statusCode": e.response.status_code
            }
        except Exception as e:
            print(f"[WebFetch] Error fetching URL: {e}")
            return {
                "success": False,
                "error": f"Failed to fetch URL: {str(e)}"
            }


# Global instances
_web_fetch_service = None

def get_web_fetch_service() -> WebFetchService:
    """Get or create WebFetchService singleton"""
    global _web_fetch_service
    if _web_fetch_service is None:
        _web_fetch_service = WebFetchService()
    return _web_fetch_service


async def execute_quendoo_tool(tool_name: str, tool_args: Dict[str, Any], api_key: str) -> Dict[str, Any]:
    """
    Execute a Quendoo tool with the tenant's API key

    Args:
        tool_name: Name of the tool to execute
        tool_args: Tool arguments
        api_key: Tenant's Quendoo API key (decrypted)

    Returns:
        Tool execution result

    Raises:
        ValueError: If tool not found
        Exception: If tool execution fails
    """
    client = QuendooAPIClient(api_key)

    # Route to appropriate tool handler
    if tool_name == "get_property_settings":
        return await client.get_property_settings(
            api_lng=tool_args.get("api_lng"),
            names=tool_args.get("names")
        )

    elif tool_name == "get_rooms_details":
        return await client.get_rooms_details(
            api_lng=tool_args.get("api_lng"),
            room_id=tool_args.get("room_id")
        )

    elif tool_name == "get_availability":
        result = await client.get_availability(
            date_from=tool_args["date_from"],
            date_to=tool_args["date_to"],
            sysres=tool_args["sysres"]
        )

        # Transform Quendoo API format to frontend-friendly format
        # Input: {"data": {"44": {"2026-02-01": 10, "2026-02-02": 10, ...}, "45": {...}}}
        # Output: {"availability": [{"room_id": 44, "date": "2026-02-01", "qty": 10, "is_opened": true}, ...]}
        if result and "data" in result:
            availability_list = []
            for room_id_str, dates_dict in result["data"].items():
                room_id = int(room_id_str)
                for date_str, qty in dates_dict.items():
                    availability_list.append({
                        "room_id": room_id,
                        "room_name": f"Room {room_id}",  # Will be enriched by frontend if needed
                        "date": date_str,
                        "qty": qty,
                        "is_opened": True
                    })

            # Sort by room_id and date
            availability_list.sort(key=lambda x: (x["room_id"], x["date"]))

            return {
                "date_from": tool_args["date_from"],
                "date_to": tool_args["date_to"],
                "availability": availability_list
            }

        return result

    elif tool_name == "update_availability":
        return await client.update_availability(
            values=tool_args["values"]
        )

    elif tool_name == "get_bookings":
        result = await client.get_bookings()
        print(f"[DEBUG] get_bookings result type: {type(result)}")
        print(f"[DEBUG] get_bookings result keys: {result.keys() if isinstance(result, dict) else 'N/A'}")
        if isinstance(result, dict) and "data" in result:
            print(f"[DEBUG] get_bookings data length: {len(result['data']) if isinstance(result['data'], list) else 'not a list'}")
        print(f"[DEBUG] get_bookings full result: {result}")
        return result

    elif tool_name == "get_booking_offers":
        return await client.get_booking_offers(
            date_from=tool_args["date_from"],
            nights=tool_args["nights"],
            bm_code=tool_args.get("bm_code"),
            api_lng=tool_args.get("api_lng"),
            guests=tool_args.get("guests"),
            currency=tool_args.get("currency")
        )

    elif tool_name == "ack_booking":
        return await client.ack_booking(
            booking_id=tool_args["booking_id"],
            revision_id=tool_args["revision_id"]
        )

    elif tool_name == "post_room_assignment":
        return await client.post_room_assignment(
            booking_id=tool_args["booking_id"],
            revision_id=tool_args["revision_id"]
        )

    elif tool_name == "post_external_property_data":
        return await client.post_external_property_data(
            data=tool_args["data"]
        )

    elif tool_name == "make_call":
        automation_client = AutomationClient()
        result = await automation_client.make_call(
            phone=tool_args["phone"],
            message=tool_args["message"],
            language=tool_args.get("language", "en-US")
        )
        return {"success": True, "result": result}

    elif tool_name == "send_quendoo_email":
        email_client = EmailClient()
        result = await email_client.send_email(
            to=tool_args["to"],
            subject=tool_args["subject"],
            message=tool_args["message"],
            html=tool_args.get("html", False)  # Default to plain text if not specified
        )
        return {"success": True, "result": result}

    # === DOCUMENT TOOLS ===

    elif tool_name == "search_hotel_documents":
        # Import document service
        from app.services.document_service import search_hotel_documents

        # Get hotelId from tool arguments (sent by backend from JWT token)
        hotel_id = tool_args.get("hotelId")
        if not hotel_id:
            return {
                "success": False,
                "error": "hotelId parameter is required for document search"
            }

        return await search_hotel_documents(
            hotel_id=hotel_id,  # Use hotel ID from JWT token (secure)
            query=tool_args["query"],
            document_types=tool_args.get("documentTypes"),
            top_k=tool_args.get("topK", 3)
        )

    elif tool_name == "list_hotel_documents":
        # Import document service
        from app.services.document_service import list_hotel_documents

        # Get hotelId from tool arguments (sent by backend from JWT token)
        hotel_id = tool_args.get("hotelId")
        if not hotel_id:
            return {
                "success": False,
                "error": "hotelId parameter is required for listing documents"
            }

        return await list_hotel_documents(
            hotel_id=hotel_id,  # Use hotel ID from JWT token (secure)
            document_types=tool_args.get("documentTypes")
        )

    elif tool_name == "analyze_data":
        # Use Claude via direct Anthropic API to analyze data with specific instructions
        import os
        from anthropic import Anthropic
        from google.cloud import secretmanager

        data = tool_args.get("data", "")
        instruction = tool_args.get("instruction", "")
        output_format = tool_args.get("format", "text")
        language = tool_args.get("language", "bulgarian")

        # Truncate data if too large (max 100k chars)
        if len(data) > 100000:
            data = data[:100000] + "\n\n[Data truncated - too large]"

        # Build prompt based on format and language
        # For html_table, we'll first generate markdown table then convert to HTML
        actual_format = "table" if output_format == "html_table" else output_format

        format_instructions = {
            "text": "Return the result as clear, human-readable text summary.",
            "json": "Return the result as valid JSON only, without any markdown formatting or explanation.",
            "table": "Return the result as a markdown table.",
            "list": "Return the result as a bulleted markdown list."
        }

        # Language instructions
        language_instructions = {
            "bulgarian": "IMPORTANT: Respond ONLY in Bulgarian language. Use Bulgarian characters (а, б, в, г, д, е, ж, з, и, й, к, л, м, н, о, п, р, с, т, у, ф, х, ц, ч, ш, щ, ъ, ь, ю, я).",
            "english": "Respond in English language."
        }

        prompt = f"""You are a data analyst. Analyze the following data according to the instruction.

DATA:
{data}

INSTRUCTION:
{instruction}

OUTPUT FORMAT:
{format_instructions.get(actual_format, format_instructions["text"])}

LANGUAGE:
{language_instructions.get(language, language_instructions["bulgarian"])}

Provide only the requested output without any additional explanation or preamble."""

        try:
            # Get Anthropic API key from Secret Manager
            project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
            secret_client = secretmanager.SecretManagerServiceClient()
            secret_name = f"projects/{project_id}/secrets/anthropic-api-key/versions/latest"

            response_secret = secret_client.access_secret_version(request={"name": secret_name})
            api_key = response_secret.payload.data.decode("UTF-8")

            # Use direct Anthropic API
            client = Anthropic(api_key=api_key)

            response = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            result = response.content[0].text

            # Convert markdown table to HTML if html_table format requested
            if output_format == "html_table":
                result = markdown_table_to_html(result)

            return {
                "success": True,
                "analysis": result,
                "format": output_format
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Analysis failed: {str(e)}"
            }

    elif tool_name == "fetch_url":
        web_fetch = get_web_fetch_service()
        return await web_fetch.fetch_url(
            url=tool_args["url"],
            format=tool_args.get("format", "html"),
            timeout=tool_args.get("timeout", 10),
            api_key=api_key  # For rate limiting per hotel
        )

    elif tool_name == "query_excel_data":
        # Import document service
        from app.services.document_service import query_excel_structured

        # Get hotelId from tool arguments (sent by backend from JWT token)
        hotel_id = tool_args.get("hotelId")
        if not hotel_id:
            return {
                "success": False,
                "error": "hotelId parameter is required for Excel queries"
            }

        return await query_excel_structured(
            hotel_id=hotel_id,  # Use hotel ID from JWT token (secure)
            query=tool_args["query"],
            file_name=tool_args.get("fileName"),
            limit=tool_args.get("limit", 10)
        )

    else:
        raise ValueError(f"Unknown tool: {tool_name}")


def list_quendoo_tools() -> list:
    """
    Get list of all available Quendoo tools with their schemas

    Returns:
        List of tool definitions (compatible with Claude API format)
    """
    return QUENDOO_TOOLS
