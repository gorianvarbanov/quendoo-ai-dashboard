"""
Multi-tenant MCP Server implementation

Implements connection-based tenant isolation:
- Each connection has unique connection_id
- connection_id -> tenant_id mapping stored in memory
- Each tool call uses tenant's API keys from database
"""
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from app.config import get_settings
from app.database import get_db, get_api_key

settings = get_settings()


class MultitenantMCPServer:
    """
    Multi-tenant MCP server with connection-based isolation

    Example usage:
        server = MultitenantMCPServer()

        # User A connects
        conn_a = await server.handle_connection(tenant_id="hotel-abc", user_id="user1")
        # conn_a = "conn_abc123..."

        # User B connects
        conn_b = await server.handle_connection(tenant_id="hotel-xyz", user_id="user2")
        # conn_b = "conn_def456..."

        # User A calls tool - uses hotel-abc's API key
        result_a = await server.handle_tool_call(conn_a, "get_bookings", {})

        # User B calls tool - uses hotel-xyz's API key
        result_b = await server.handle_tool_call(conn_b, "get_bookings", {})

        # ✓ Complete isolation - each tenant uses their own API keys
    """

    def __init__(self):
        """Initialize MCP server with empty connection registry"""
        # connection_id -> connection context
        self.connections: Dict[str, Dict[str, Any]] = {}

        # Track connection metadata
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}

        print("[MCP Server] Initialized MultitenantMCPServer")

    async def handle_connection(
        self,
        tenant_id: str,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Handle new connection request

        Args:
            tenant_id: Tenant identifier (hotel ID)
            user_id: Optional user identifier
            metadata: Optional metadata about the connection

        Returns:
            connection_id: Unique connection identifier

        Note:
            Quendoo API key is now provided per-request via X-Quendoo-Api-Key header,
            not stored in connection context. This allows each user to provide their own key.

        Example:
            >>> server = MultitenantMCPServer()
            >>> connection_id = await server.handle_connection("hotel-123", "user-456")
            >>> print(connection_id)
            'conn_abc123...'
        """
        # Generate unique connection ID
        connection_id = f"conn_{uuid.uuid4().hex[:16]}"

        # Store connection context (without API key - it's per-request now)
        self.connections[connection_id] = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "created_at": datetime.utcnow(),
            "last_used": datetime.utcnow()
        }

        # Store metadata
        self.connection_metadata[connection_id] = metadata or {}

        print(f"[MCP Server] New connection: {connection_id} -> tenant: {tenant_id} (API key per-request)")

        # Clean up old connections
        await self._cleanup_old_connections()

        return connection_id

    async def handle_tool_call(
        self,
        connection_id: str,
        tool_name: str,
        tool_args: Dict[str, Any],
        quendoo_api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Handle tool execution request

        Args:
            connection_id: Connection identifier
            tool_name: Name of the tool to execute
            tool_args: Tool arguments
            quendoo_api_key: User's Quendoo API key (per-request, optional)

        Returns:
            Tool execution result

        Raises:
            ValueError: If connection_id not found or API key not provided
            Exception: If tool execution fails

        Example:
            >>> result = await server.handle_tool_call(
            ...     "conn_abc123",
            ...     "get_availability",
            ...     {"date_from": "2026-03-01", "date_to": "2026-03-10", "sysres": "qdo"},
            ...     quendoo_api_key="user_api_key"
            ... )
        """
        # Get connection context
        context = self.get_connection_context(connection_id)
        if not context:
            raise ValueError(f"Connection not found: {connection_id}")

        # Update last used timestamp
        context["last_used"] = datetime.utcnow()

        tenant_id = context["tenant_id"]

        # Use provided API key (per-request) instead of stored one
        if not quendoo_api_key:
            raise ValueError("Quendoo API key is required for tool execution")

        print(f"[MCP Server] Tool call: {tool_name} for tenant: {tenant_id} with user-provided API key")

        # Import here to avoid circular dependency
        from app.quendoo.tools import execute_quendoo_tool

        try:
            # Execute tool with user's API key (passed per-request)
            result = await execute_quendoo_tool(
                tool_name=tool_name,
                tool_args=tool_args,
                api_key=quendoo_api_key
            )

            return {
                "success": True,
                "result": result,
                "connection_id": connection_id,
                "tool_name": tool_name
            }

        except Exception as e:
            print(f"[MCP Server] Tool execution failed: {tool_name} - {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "connection_id": connection_id,
                "tool_name": tool_name
            }

    def get_connection_context(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """
        Get connection context by connection_id

        Args:
            connection_id: Connection identifier

        Returns:
            Connection context dictionary or None if not found
        """
        return self.connections.get(connection_id)

    def get_tenant_id(self, connection_id: str) -> Optional[str]:
        """
        Get tenant_id for a connection

        Args:
            connection_id: Connection identifier

        Returns:
            tenant_id or None if connection not found
        """
        context = self.get_connection_context(connection_id)
        return context["tenant_id"] if context else None

    async def disconnect(self, connection_id: str) -> bool:
        """
        Disconnect and cleanup connection

        Args:
            connection_id: Connection identifier

        Returns:
            True if disconnected, False if not found
        """
        if connection_id in self.connections:
            tenant_id = self.connections[connection_id]["tenant_id"]
            print(f"[MCP Server] Disconnected: {connection_id} (tenant: {tenant_id})")

            del self.connections[connection_id]
            if connection_id in self.connection_metadata:
                del self.connection_metadata[connection_id]

            return True
        return False

    async def _cleanup_old_connections(self):
        """
        Cleanup connections that haven't been used for CONNECTION_TIMEOUT_MINUTES

        Runs automatically when new connections are established
        """
        timeout_minutes = settings.CONNECTION_TIMEOUT_MINUTES
        cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)

        expired_connections = []
        for conn_id, context in self.connections.items():
            if context["last_used"] < cutoff_time:
                expired_connections.append(conn_id)

        for conn_id in expired_connections:
            await self.disconnect(conn_id)
            print(f"[MCP Server] Cleaned up expired connection: {conn_id}")

    def get_active_connections(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all active connections (without API keys for security)

        Returns:
            Dictionary of active connections with sanitized data
        """
        sanitized = {}
        for conn_id, context in self.connections.items():
            sanitized[conn_id] = {
                "tenant_id": context["tenant_id"],
                "user_id": context["user_id"],
                "created_at": context["created_at"].isoformat(),
                "last_used": context["last_used"].isoformat()
            }
        return sanitized

    def get_connection_count_by_tenant(self, tenant_id: str) -> int:
        """
        Get number of active connections for a tenant

        Args:
            tenant_id: Tenant identifier

        Returns:
            Number of active connections
        """
        count = 0
        for context in self.connections.values():
            if context["tenant_id"] == tenant_id:
                count += 1
        return count


# Global MCP server instance
mcp_server = MultitenantMCPServer()


def get_mcp_server() -> MultitenantMCPServer:
    """Get global MCP server instance"""
    return mcp_server
