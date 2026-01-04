"""
SSE (Server-Sent Events) endpoint for MCP protocol compatibility

This endpoint provides SSE-based communication for MCP clients that expect
EventSource connections (like the backend QuendooClaudeIntegration).
"""
import json
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from uuid import uuid4

router = APIRouter(prefix="/sse", tags=["SSE"])


@router.get("")
async def sse_endpoint(request: Request):
    """
    SSE endpoint that provides session_id via 'endpoint' event

    Compatible with EventSource clients that expect:
    1. 'endpoint' event with session_id and POST URL
    2. 'message' events for JSON-RPC responses

    Example flow:
    1. Client connects via EventSource("https://server/sse")
    2. Server sends: event: endpoint\ndata: /messages/?session_id=abc123
    3. Client extracts session_id and POST URL
    4. Client sends JSON-RPC requests to POST URL
    5. Server responds via SSE 'message' events
    """

    # Generate unique session ID
    session_id = f"session_{uuid4().hex[:16]}"

    print(f"[SSE] New SSE connection, session_id: {session_id}")

    async def event_generator():
        """Generate SSE events"""
        try:
            # Send endpoint event with session_id
            # This matches what EventSource clients expect
            endpoint_path = f"/messages/?session_id={session_id}"

            # SSE format: event: endpoint\ndata: <path>\n\n
            yield f"event: endpoint\n"
            yield f"data: {endpoint_path}\n\n"

            print(f"[SSE] Sent endpoint event: {endpoint_path}")

            # Keep connection alive with periodic heartbeats
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    print(f"[SSE] Client disconnected: {session_id}")
                    break

                # Send keepalive comment (SSE spec)
                yield ": keepalive\n\n"

                await asyncio.sleep(30)  # Heartbeat every 30 seconds

        except asyncio.CancelledError:
            print(f"[SSE] Connection cancelled: {session_id}")
        except Exception as e:
            print(f"[SSE] Error in event generator: {e}")
            import traceback
            traceback.print_exc()

    # Return StreamingResponse with SSE headers
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )
