"""
FastMCP Server for Quendoo Integration
Uses FastMCP library for SSE-based MCP protocol support
"""
import os
import sys
from typing import Optional
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Import Quendoo API client
from app.quendoo.client import QuendooAPIClient

load_dotenv()

# ========================================
# INITIALIZE FASTMCP SERVER
# ========================================

server = FastMCP(
    name="quendoo-mcp-chatbot",
    instructions=(
        "Quendoo Property Management System - AI Chatbot Integration\n\n"
        "🏨 HOTEL OPERATIONS:\n"
        "- Property Management: Get property settings, rooms, rates\n"
        "- Availability: Check and update room availability\n"
        "- Bookings: Get offers, create bookings, manage reservations\n\n"
        "🔑 AUTHENTICATION:\n"
        "All requests require user-provided Quendoo API key via X-Quendoo-Api-Key header\n"
    ),
    host=os.getenv("HOST", "0.0.0.0"),
    port=int(os.getenv("PORT", "8000")),
)

# ========================================
# CONTEXT STORAGE FOR API KEYS
# ========================================

# Store API keys per session (in-memory for now)
# In production, this could be stored in Redis or similar
_session_api_keys = {}


def get_quendoo_client(session_id: str, api_key: Optional[str] = None) -> QuendooAPIClient:
    """
    Get Quendoo API client for the current session

    Args:
        session_id: Session identifier
        api_key: Optional API key to store for this session

    Returns:
        QuendooAPIClient instance

    Raises:
        ValueError: If no API key is available
    """
    # Store API key if provided
    if api_key:
        _session_api_keys[session_id] = api_key
        print(f"[DEBUG] Stored API key for session: {session_id}", file=sys.stderr, flush=True)

    # Get API key from session storage
    stored_key = _session_api_keys.get(session_id)

    if not stored_key:
        raise ValueError(
            "Quendoo API key not provided. "
            "Please provide your API key via X-Quendoo-Api-Key header."
        )

    return QuendooAPIClient(api_key=stored_key)


# ========================================
# PROPERTY MANAGEMENT TOOLS
# ========================================

@server.tool()
def get_property_settings(
    session_id: str,
    api_key: Optional[str] = None,
    api_lng: Optional[str] = None,
    names: Optional[str] = None
) -> dict:
    """
    Get property settings including rooms, rates, services, meals, beds, booking modules.

    Args:
        session_id: Session identifier (automatically provided by MCP)
        api_key: Your Quendoo API key (provide once per session)
        api_lng: Language code (e.g., 'en', 'bg'). Optional.
        names: Comma-separated list of setting names. Optional.

    Returns:
        Property settings data
    """
    print(f"[TOOL] get_property_settings called for session: {session_id}", file=sys.stderr, flush=True)

    client = get_quendoo_client(session_id, api_key)

    params = {}
    if api_lng:
        params["api_lng"] = api_lng
    if names:
        params["names"] = names

    # Use async client synchronously (FastMCP handles this)
    import asyncio
    return asyncio.run(client.get_property_settings(**params))


@server.tool()
def get_rooms_details(
    session_id: str,
    api_key: Optional[str] = None,
    api_lng: Optional[str] = None,
    room_id: Optional[int] = None
) -> dict:
    """
    Get detailed information for rooms.

    Args:
        session_id: Session identifier (automatically provided)
        api_key: Your Quendoo API key (provide once per session)
        api_lng: Language code. Optional.
        room_id: Specific room ID. Optional (returns all rooms if omitted).
    """
    print(f"[TOOL] get_rooms_details called", file=sys.stderr, flush=True)

    client = get_quendoo_client(session_id, api_key)

    import asyncio
    return asyncio.run(client.get_rooms_details(api_lng=api_lng, room_id=room_id))


# ========================================
# AVAILABILITY TOOLS
# ========================================

@server.tool(name="get_availability")
def quendoo_get_availability(
    session_id: str,
    date_from: str,
    date_to: str,
    sysres: str,
    api_key: Optional[str] = None
) -> dict:
    """
    Get availability for a date range.

    Args:
        session_id: Session identifier
        date_from: Start date in YYYY-MM-DD format
        date_to: End date in YYYY-MM-DD format
        sysres: System reservation type ('qdo' for Quendoo or 'ext' for external)
        api_key: Your Quendoo API key (provide once per session)
    """
    print(f"[TOOL] get_availability called: {date_from} to {date_to}", file=sys.stderr, flush=True)

    client = get_quendoo_client(session_id, api_key)

    import asyncio
    return asyncio.run(client.get_availability(
        date_from=date_from,
        date_to=date_to,
        sysres=sysres
    ))


@server.tool()
def update_availability(
    session_id: str,
    values: list,
    api_key: Optional[str] = None
) -> dict:
    """
    Update availability values for rooms.

    Args:
        session_id: Session identifier
        values: List of availability updates with date, room_id, avail
        api_key: Your Quendoo API key (provide once per session)
    """
    print(f"[TOOL] update_availability called", file=sys.stderr, flush=True)

    client = get_quendoo_client(session_id, api_key)

    import asyncio
    return asyncio.run(client.update_availability(values=values))


# ========================================
# BOOKING TOOLS
# ========================================

@server.tool()
def get_bookings(
    session_id: str,
    api_key: Optional[str] = None
) -> dict:
    """
    List all bookings for the property.

    Args:
        session_id: Session identifier
        api_key: Your Quendoo API key (provide once per session)
    """
    print(f"[TOOL] get_bookings called", file=sys.stderr, flush=True)

    client = get_quendoo_client(session_id, api_key)

    import asyncio
    return asyncio.run(client.get_bookings())


@server.tool()
def get_booking_offers(
    session_id: str,
    date_from: str,
    nights: int,
    api_key: Optional[str] = None,
    bm_code: Optional[str] = None,
    api_lng: Optional[str] = None,
    guests: Optional[list] = None,
    currency: Optional[str] = None
) -> dict:
    """
    Fetch booking offers for stay dates.

    Args:
        session_id: Session identifier
        date_from: Check-in date in YYYY-MM-DD format
        nights: Number of nights
        api_key: Your Quendoo API key (provide once per session)
        bm_code: Booking module code. Optional (auto-detects if omitted).
        api_lng: Language code. Optional.
        guests: List of guest configurations. Optional.
        currency: Currency code (e.g., 'EUR', 'USD'). Optional.
    """
    print(f"[TOOL] get_booking_offers called", file=sys.stderr, flush=True)

    client = get_quendoo_client(session_id, api_key)

    import asyncio
    return asyncio.run(client.get_booking_offers(
        date_from=date_from,
        nights=nights,
        bm_code=bm_code,
        api_lng=api_lng,
        guests=guests,
        currency=currency
    ))


@server.tool()
def ack_booking(
    session_id: str,
    booking_id: int,
    revision_id: str,
    api_key: Optional[str] = None
) -> dict:
    """
    Acknowledge a booking.

    Args:
        session_id: Session identifier
        booking_id: Booking ID
        revision_id: Revision ID
        api_key: Your Quendoo API key (provide once per session)
    """
    print(f"[TOOL] ack_booking called", file=sys.stderr, flush=True)

    client = get_quendoo_client(session_id, api_key)

    import asyncio
    return asyncio.run(client.ack_booking(
        booking_id=booking_id,
        revision_id=revision_id
    ))


@server.tool()
def post_room_assignment(
    session_id: str,
    booking_id: int,
    revision_id: str,
    api_key: Optional[str] = None
) -> dict:
    """
    Send room assignment for a booking.

    Args:
        session_id: Session identifier
        booking_id: Booking ID
        revision_id: Revision ID
        api_key: Your Quendoo API key (provide once per session)
    """
    print(f"[TOOL] post_room_assignment called", file=sys.stderr, flush=True)

    client = get_quendoo_client(session_id, api_key)

    import asyncio
    return asyncio.run(client.post_room_assignment(
        booking_id=booking_id,
        revision_id=revision_id
    ))


# ========================================
# MAIN
# ========================================

if __name__ == "__main__":
    print("=" * 60, file=sys.stderr, flush=True)
    print("Quendoo MCP Server - FastMCP with SSE", file=sys.stderr, flush=True)
    print("=" * 60, file=sys.stderr, flush=True)

    # Use SSE transport for compatibility with backend
    transport = os.getenv("MCP_TRANSPORT", "sse").lower()
    port = int(os.getenv("PORT", "8000"))

    print(f"✓ Transport: {transport}", file=sys.stderr, flush=True)
    print(f"✓ Port: {port}", file=sys.stderr, flush=True)
    print("=" * 60, file=sys.stderr, flush=True)

    # Run with SSE transport
    server.run(transport=transport)
