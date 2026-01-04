"""
Hybrid FastAPI + FastMCP Server
Combines FastAPI for HTTP/SSE handling with FastMCP for MCP protocol
"""
import os
import sys
import json
import asyncio
from typing import Optional
from fastapi import FastAPI, Request, Header
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv

# Import our FastMCP server
from fastmcp_server import server as mcp_server, _session_api_keys

load_dotenv()

# ========================================
# FASTAPI APP WRAPPER
# ========================================

app = FastAPI(
    title="Quendoo MCP Chatbot - Hybrid Server",
    description="FastMCP server with FastAPI wrapper for header extraction",
    version="1.0.0"
)


@app.get("/health")
async def health():
    """Health check for Cloud Run"""
    return {
        "status": "healthy",
        "service": "mcp-quendoo-chatbot-hybrid",
        "transport": "sse"
    }


@app.get("/sse")
async def sse_endpoint(request: Request):
    """
    SSE endpoint that provides session_id and keeps connection alive

    Compatible with backend EventSource that expects:
    1. 'endpoint' event with session_id
    2. POST endpoint at /messages/?session_id=xxx
    """
    from uuid import uuid4

    # Generate unique session ID
    session_id = f"session_{uuid4().hex[:16]}"

    print(f"[SSE] New connection, session_id: {session_id}", file=sys.stderr, flush=True)

    async def event_generator():
        """Generate SSE events"""
        try:
            # Send endpoint event with session_id
            endpoint_path = f"/messages/?session_id={session_id}"
            yield f"event: endpoint\n"
            yield f"data: {endpoint_path}\n\n"

            print(f"[SSE] Sent endpoint: {endpoint_path}", file=sys.stderr, flush=True)

            # Keep connection alive with heartbeats
            while True:
                if await request.is_disconnected():
                    print(f"[SSE] Client disconnected: {session_id}", file=sys.stderr, flush=True)
                    break

                yield ": keepalive\n\n"
                await asyncio.sleep(30)

        except asyncio.CancelledError:
            print(f"[SSE] Connection cancelled: {session_id}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"[SSE] Error: {e}", file=sys.stderr, flush=True)
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


@app.post("/messages/")
async def messages_endpoint(
    request: Request,
    session_id: str,
    x_quendoo_api_key: Optional[str] = Header(None)
):
    """
    Handle JSON-RPC messages from backend

    Extracts Quendoo API key from header and stores it in session context,
    then forwards to FastMCP for processing
    """
    try:
        # Parse JSON-RPC request
        body = await request.json()

        print(f"[Messages] Received JSON-RPC request for session: {session_id}", file=sys.stderr, flush=True)
        print(f"[Messages] Method: {body.get('method')}", file=sys.stderr, flush=True)
        print(f"[Messages] Has API key header: {x_quendoo_api_key is not None}", file=sys.stderr, flush=True)

        # Store API key in session if provided
        if x_quendoo_api_key:
            _session_api_keys[session_id] = x_quendoo_api_key
            print(f"[Messages] Stored API key for session: {session_id}", file=sys.stderr, flush=True)

        # Forward to FastMCP for processing
        # Add session_id to params if not present
        if 'params' not in body:
            body['params'] = {}

        if isinstance(body['params'], dict):
            body['params']['session_id'] = session_id

        # Process with FastMCP
        # Since FastMCP tools expect session_id as first parameter,
        # we handle different methods differently

        method = body.get('method')
        params = body.get('params', {})
        msg_id = body.get('id', 1)

        if method == 'initialize':
            # Handle initialize
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "quendoo-mcp-chatbot",
                        "version": "1.0.0"
                    }
                }
            }
            return JSONResponse(response)

        elif method == 'tools/list':
            # Get tools from FastMCP server
            tools_list = []

            # Extract tool definitions from FastMCP server
            for tool_name, tool_func in mcp_server._tools.items():
                # Get function signature and docstring
                import inspect
                sig = inspect.signature(tool_func)
                doc = inspect.getdoc(tool_func) or ""

                # Build input schema from parameters
                properties = {}
                required = []

                for param_name, param in sig.parameters.items():
                    # Skip session_id and api_key
                    if param_name in ['session_id', 'api_key']:
                        continue

                    # Determine type
                    param_type = "string"
                    if param.annotation != inspect.Parameter.empty:
                        if param.annotation == int:
                            param_type = "integer"
                        elif param.annotation == list:
                            param_type = "array"
                        elif param.annotation == dict:
                            param_type = "object"

                    properties[param_name] = {"type": param_type}

                    # Check if required (no default value)
                    if param.default == inspect.Parameter.empty:
                        required.append(param_name)

                tools_list.append({
                    "name": tool_name,
                    "description": doc.split('\n')[0] if doc else f"Tool: {tool_name}",
                    "inputSchema": {
                        "type": "object",
                        "properties": properties,
                        "required": required
                    }
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
            # Execute tool call
            tool_name = params.get('name')
            tool_args = params.get('arguments', {})

            print(f"[Messages] Executing tool: {tool_name}", file=sys.stderr, flush=True)

            # Get tool function from FastMCP
            if tool_name not in mcp_server._tools:
                response = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {
                        "code": -32601,
                        "message": f"Tool not found: {tool_name}"
                    }
                }
                return JSONResponse(response)

            tool_func = mcp_server._tools[tool_name]

            # Add session_id to args
            tool_args['session_id'] = session_id

            # Execute tool (handle both sync and async)
            import inspect
            try:
                if inspect.iscoroutinefunction(tool_func):
                    result = await tool_func(**tool_args)
                else:
                    result = tool_func(**tool_args)

                response = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "result": result
                    }
                }
                return JSONResponse(response)

            except Exception as e:
                print(f"[Messages] Tool execution error: {e}", file=sys.stderr, flush=True)
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
                return JSONResponse(response)

        else:
            response = {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                }
            }
            return JSONResponse(response)

    except Exception as e:
        print(f"[Messages] Error processing request: {e}", file=sys.stderr, flush=True)
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


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Quendoo MCP Chatbot - Hybrid Server",
        "version": "1.0.0",
        "transport": "sse",
        "endpoints": {
            "sse": "/sse",
            "messages": "/messages/?session_id=xxx",
            "health": "/health"
        }
    }


# ========================================
# MAIN
# ========================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    print("=" * 60, file=sys.stderr, flush=True)
    print("Quendoo MCP Hybrid Server Starting", file=sys.stderr, flush=True)
    print(f"Port: {port}", file=sys.stderr, flush=True)
    print(f"Transport: SSE", file=sys.stderr, flush=True)
    print("=" * 60, file=sys.stderr, flush=True)

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
