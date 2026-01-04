"""
MCP Protocol endpoints for connection and tool execution
"""
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.models.tenant import (
    ConnectionRequest,
    ConnectionResponse,
    ToolExecuteRequest,
    ToolExecuteResponse
)
from app.mcp.protocol import get_mcp_server
from app.quendoo.tools import list_quendoo_tools

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.post("/connect", response_model=ConnectionResponse)
async def connect(request: ConnectionRequest):
    """
    Establish MCP connection for a tenant

    Creates a new connection_id and stores tenant context

    Example:
        POST /mcp/connect
        {
            "tenant_id": "hotel-abc-123",
            "user_id": "user-456",
            "metadata": {"source": "dashboard"}
        }

        Response:
        {
            "connection_id": "conn_abc123...",
            "tenant_id": "hotel-abc-123",
            "created_at": "2026-01-04T10:30:00Z"
        }
    """
    server = get_mcp_server()

    try:
        connection_id = await server.handle_connection(
            tenant_id=request.tenant_id,
            user_id=request.user_id,
            metadata=request.metadata
        )

        context = server.get_connection_context(connection_id)

        return ConnectionResponse(
            connection_id=connection_id,
            tenant_id=request.tenant_id,
            created_at=context["created_at"]
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")


@router.post("/tools/execute", response_model=ToolExecuteResponse)
async def execute_tool(
    request: ToolExecuteRequest,
    x_quendoo_api_key: Optional[str] = Header(None)
):
    """
    Execute a tool via MCP connection

    Uses the Quendoo API key from X-Quendoo-Api-Key header (user-provided per request)

    Example:
        POST /mcp/tools/execute
        Headers: X-Quendoo-Api-Key: <user's quendoo api key>
        {
            "connection_id": "conn_abc123...",
            "tool_name": "get_availability",
            "tool_args": {
                "date_from": "2026-03-01",
                "date_to": "2026-03-10",
                "sysres": "qdo"
            }
        }

        Response:
        {
            "connection_id": "conn_abc123...",
            "tool_name": "get_availability",
            "result": { "data": { ... } },
            "error": null
        }
    """
    # Validate Quendoo API key is provided
    if not x_quendoo_api_key:
        raise HTTPException(
            status_code=400,
            detail="X-Quendoo-Api-Key header is required"
        )

    server = get_mcp_server()

    try:
        result = await server.handle_tool_call(
            connection_id=request.connection_id,
            tool_name=request.tool_name,
            tool_args=request.tool_args,
            quendoo_api_key=x_quendoo_api_key  # Pass user's API key
        )

        if result.get("success"):
            return ToolExecuteResponse(
                connection_id=request.connection_id,
                tool_name=request.tool_name,
                result=result.get("result", {}),
                error=None
            )
        else:
            return ToolExecuteResponse(
                connection_id=request.connection_id,
                tool_name=request.tool_name,
                result={},
                error=result.get("error")
            )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tool execution failed: {str(e)}")


@router.post("/disconnect")
async def disconnect(connection_id: str):
    """
    Disconnect and cleanup MCP connection

    Example:
        POST /mcp/disconnect?connection_id=conn_abc123...

        Response:
        {
            "success": true,
            "connection_id": "conn_abc123..."
        }
    """
    server = get_mcp_server()

    success = await server.disconnect(connection_id)

    if not success:
        raise HTTPException(status_code=404, detail=f"Connection not found: {connection_id}")

    return {
        "success": True,
        "connection_id": connection_id
    }


@router.get("/tools/list")
async def list_tools():
    """
    List all available Quendoo tools

    Returns tool definitions compatible with Claude API format

    Example:
        GET /mcp/tools/list

        Response:
        {
            "tools": [
                {
                    "name": "get_property_settings",
                    "description": "...",
                    "inputSchema": { ... }
                },
                ...
            ]
        }
    """
    tools = list_quendoo_tools()
    return {"tools": tools}


@router.get("/connections")
async def list_connections():
    """
    List all active MCP connections (admin endpoint)

    Returns sanitized connection data without API keys

    Example:
        GET /mcp/connections

        Response:
        {
            "connections": {
                "conn_abc123": {
                    "tenant_id": "hotel-abc",
                    "user_id": "user-456",
                    "created_at": "2026-01-04T10:30:00Z",
                    "last_used": "2026-01-04T10:35:00Z"
                }
            },
            "total": 1
        }
    """
    server = get_mcp_server()
    connections = server.get_active_connections()

    return {
        "connections": connections,
        "total": len(connections)
    }
