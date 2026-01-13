/**
 * SSE Client Transport for Remote MCP Servers
 * Based on: https://modelcontextprotocol.io/docs/develop/connect-remote-servers
 *
 * This transport uses:
 * - SSE (Server-Sent Events) for receiving messages from the server
 * - HTTP POST for sending messages to the server
 */

import { EventSource } from 'eventsource';
import fetch from 'node-fetch';

export class SSEClientTransport {
  constructor(url, options = {}) {
    // Parse URL to get base endpoint
    const urlObj = new URL(url);
    this._sseUrl = url;

    // For MCP HTTP+SSE transport, POST goes to the same endpoint as the SSE stream
    // According to MCP spec: same endpoint for both GET (SSE) and POST (messages)
    this._postUrl = options.postUrl || url;

    this._eventSource = null;
    this._messageBuffer = '';
    this._sessionId = null;

    // Transport interface callbacks
    this.onclose = undefined;
    this.onerror = undefined;
    this.onmessage = undefined;
  }

  get sessionId() {
    return this._sessionId;
  }

  set sessionId(value) {
    this._sessionId = value;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this._eventSource = new EventSource(this._sseUrl);

      this._eventSource.onopen = () => {
        console.log('[SSE Transport] Connected to', this._sseUrl);
        // Don't resolve yet - wait for endpoint event
      };

      this._eventSource.onerror = (error) => {
        console.error('[SSE Transport] Error:', error);
        if (!this._eventSource || this._eventSource.readyState === EventSource.CLOSED) {
          reject(new Error('Failed to connect to SSE endpoint'));
        }
      };

      // Listen for 'endpoint' event from Quendoo server
      this._eventSource.addEventListener('endpoint', (event) => {
        console.log('[SSE Transport] Received endpoint:', event.data);
        // Extract session_id from endpoint like "/messages/?session_id=xxx"
        const match = event.data.match(/session_id=([^&]+)/);
        if (match) {
          this._sessionId = match[1];
          // Build the full POST URL
          const baseUrl = new URL(this._sseUrl);
          this._postUrl = `${baseUrl.protocol}//${baseUrl.host}${event.data}`;
          console.log('[SSE Transport] POST endpoint:', this._postUrl);
          resolve();
        } else {
          reject(new Error('No session_id in endpoint event'));
        }
      });

      this._eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[SSE Transport] Received message:', message);
          this.onmessage?.(message);
        } catch (error) {
          console.error('[SSE Transport] Failed to parse message:', error);
        }
      };

      // Handle other event types
      this._eventSource.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          this.onmessage?.(message);
        } catch (error) {
          console.error('[SSE Transport] Failed to parse event:', error);
        }
      });
    });
  }

  async send(message) {
    try {
      console.log('[SSE Transport] Sending message via POST to', this._postUrl);
      console.log('[SSE Transport] Message payload:', JSON.stringify(message, null, 2));

      const response = await fetch(this._postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      console.log('[SSE Transport] Message sent successfully');
    } catch (error) {
      console.error('[SSE Transport] Failed to send message:', error);
      throw error;
    }
  }

  async close() {
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
      console.log('[SSE Transport] Closed');
    }
    this.onclose?.();
  }
}
