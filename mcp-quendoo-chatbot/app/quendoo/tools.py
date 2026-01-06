"""
Quendoo tool implementations - all tools from existing MCP server

Tools are called with tenant's API key to ensure proper isolation
"""
from typing import Dict, Any
import os
import httpx
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
        "description": "Fetch booking offers for a booking module code and stay dates. ALWAYS ask the user for check-in date, number of nights, and number of guests if not explicitly provided in their message.",
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
        "description": "Initiate a voice call with a spoken message using Quendoo automation service.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "phone": {
                    "type": "string",
                    "description": "Phone number to call"
                },
                "message": {
                    "type": "string",
                    "description": "Message to speak during the call"
                }
            },
            "required": ["phone", "message"]
        }
    },
    {
        "name": "send_quendoo_email",
        "description": "Send an email via Quendoo email service. Supports HTML content in the message body.",
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
                    "description": "Email body (supports HTML)"
                }
            },
            "required": ["to", "subject", "message"]
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

    async def make_call(self, phone: str, message: str) -> Dict[str, Any]:
        """Make a voice call with spoken message."""
        if not self.bearer_token:
            raise ValueError("QUENDOO_AUTOMATION_BEARER environment variable is not set")

        url = f"{self.base_url}/make_call"
        headers = {
            "Authorization": f"Bearer {self.bearer_token}",
            "Content-Type": "application/json"
        }
        payload = {"phone": phone, "message": message}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json() if resp.content else {"status": resp.status_code}
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Automation request failed with status {exc.response.status_code}: {exc.response.text}"
            ) from exc


# Email client for send_quendoo_email
class EmailClient:
    """HTTP client for sending emails via Quendoo email service."""

    EMAIL_SERVICE_URL = "https://us-central1-quednoo-chatgtp-mailing.cloudfunctions.net/send_quendoo_email"

    def __init__(self):
        self.api_key = os.getenv("EMAIL_API_KEY")

    async def send_email(self, to: str, subject: str, message: str) -> Dict[str, Any]:
        """Send an email via the Quendoo email cloud function."""
        if not self.api_key:
            raise ValueError("EMAIL_API_KEY environment variable is not set")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "to": to,
            "subject": subject,
            "message": message
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
            message=tool_args["message"]
        )
        return {"success": True, "result": result}

    elif tool_name == "send_quendoo_email":
        email_client = EmailClient()
        result = await email_client.send_email(
            to=tool_args["to"],
            subject=tool_args["subject"],
            message=tool_args["message"]
        )
        return {"success": True, "result": result}

    else:
        raise ValueError(f"Unknown tool: {tool_name}")


def list_quendoo_tools() -> list:
    """
    Get list of all available Quendoo tools with their schemas

    Returns:
        List of tool definitions (compatible with Claude API format)
    """
    return QUENDOO_TOOLS
