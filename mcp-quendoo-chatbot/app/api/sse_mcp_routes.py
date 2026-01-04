"""
SSE endpoint for MCP protocol compatibility with backend EventSource
"""
import json
import asyncio
from fastapi import APIRouter, Request, Header
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional
from uuid import uuid4

from app.mcp.protocol import get_mcp_server
from app.models.tenant import ToolExecuteRequest

router = APIRouter(tags=["SSE-MCP"])

# Store API keys per session (in-memory)
_session_api_keys = {}
_session_connections = {}


@router.get("/sse")
async def sse_mcp_endpoint(request: Request):
    """
    SSE endpoint that provides session_id for MCP communication

    Compatible with backend EventSource that expects:
    1. 'endpoint' event with session_id
    2. POST endpoint at /messages/?session_id=xxx
    """
    # Generate unique session ID
    session_id = f"session_{uuid4().hex[:16]}"

    print(f"[SSE] New connection, session_id: {session_id}")

    async def event_generator():
        """Generate SSE events"""
        try:
            # Send endpoint event with session_id
            endpoint_path = f"/messages/?session_id={session_id}"
            yield f"event: endpoint\n"
            yield f"data: {endpoint_path}\n\n"

            print(f"[SSE] Sent endpoint: {endpoint_path}")

            # Keep connection alive
            while True:
                if await request.is_disconnected():
                    print(f"[SSE] Client disconnected: {session_id}")
                    # Cleanup
                    _session_api_keys.pop(session_id, None)
                    _session_connections.pop(session_id, None)
                    break

                yield ": keepalive\n\n"
                await asyncio.sleep(30)

        except asyncio.CancelledError:
            print(f"[SSE] Connection cancelled: {session_id}")
            _session_api_keys.pop(session_id, None)
            _session_connections.pop(session_id, None)
        except Exception as e:
            print(f"[SSE] Error: {e}")
            import traceback
            traceback.print_exc()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )


@router.post("/messages/")
async def messages_mcp_endpoint(
    request: Request,
    session_id: str,
    x_quendoo_api_key: Optional[str] = Header(None)
):
    """
    Handle JSON-RPC messages from backend

    Extracts Quendoo API key from header and processes MCP requests
    """
    try:
        # Parse JSON-RPC request
        body = await request.json()

        print(f"[Messages] Received for session: {session_id}, method: {body.get('method')}")

        # Store API key if provided
        if x_quendoo_api_key:
            _session_api_keys[session_id] = x_quendoo_api_key
            print(f"[Messages] Stored API key for session: {session_id}")

        method = body.get('method')
        params = body.get('params', {})
        msg_id = body.get('id', 1)

        if method == 'initialize':
            # Handle MCP initialize
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "mcp-quendoo-chatbot",
                        "version": "1.0.0"
                    }
                }
            }
            return JSONResponse(response)

        elif method == 'tools/list':
            # Get available tools
            from app.quendoo.tools import list_quendoo_tools

            tools = list_quendoo_tools()

            # Convert to MCP format
            tools_list = []
            for tool in tools:
                tools_list.append({
                    "name": tool["name"],
                    "description": tool["description"],
                    "inputSchema": tool["inputSchema"]
                })

            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "tools": tools_list
                }
            }
            return JSONResponse(response)

        elif method == 'tools/call':
            # Execute tool
            tool_name = params.get('name')
            tool_args = params.get('arguments', {})

            print(f"[Messages] Executing tool: {tool_name}")

            # Get API key from session
            api_key = _session_api_keys.get(session_id)

            if not api_key:
                response = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {
                        "code": -32600,
                        "message": "Quendoo API key not provided. Please provide X-Quendoo-Api-Key header."
                    }
                }
                return JSONResponse(response, status_code=400)

            # Get or create MCP connection for this session
            if session_id not in _session_connections:
                server = get_mcp_server()
                # Create connection (tenant_id and user_id are not used since we use per-request API key)
                connection_id = await server.handle_connection(
                    tenant_id="sse-session",
                    user_id=session_id
                )
                _session_connections[session_id] = connection_id

            connection_id = _session_connections[session_id]

            # Execute tool
            server = get_mcp_server()

            try:
                result = await server.handle_tool_call(
                    connection_id=connection_id,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    quendoo_api_key=api_key
                )

                if result.get("success"):
                    response = {
                        "jsonrpc": "2.0",
                        "id": msg_id,
                        "result": {
                            "result": result.get("result", {})
                        }
                    }
                    return JSONResponse(response)
                else:
                    response = {
                        "jsonrpc": "2.0",
                        "id": msg_id,
                        "error": {
                            "code": -32603,
                            "message": result.get("error", "Tool execution failed")
                        }
                    }
                    return JSONResponse(response, status_code=500)

            except Exception as e:
                print(f"[Messages] Tool execution error: {e}")
                import traceback
                traceback.print_exc()

                response = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {
                        "code": -32603,
                        "message": str(e)
                    }
                }
                return JSONResponse(response, status_code=500)

        else:
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                }
            }
            return JSONResponse(response, status_code=404)

    except Exception as e:
        print(f"[Messages] Error processing request: {e}")
        import traceback
        traceback.print_exc()

        return JSONResponse({
            "jsonrpc": "2.0",
            "id": body.get('id', 1) if 'body' in locals() else 1,
            "error": {
                "code": -32603,
                "message": f"Internal error: {str(e)}"
            }
        }, status_code=500)
