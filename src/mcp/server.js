#!/usr/bin/env node
'use strict';

const { getRecentContext, searchContext, getSessionContext, listSessions } = require('./tools');

const SERVER_INFO = {
  name: 'familiar',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'get_recent_context',
    description: 'Get context captured by Familiar in the last N minutes. Returns OCR-extracted text and metadata from your screen captures.',
    inputSchema: {
      type: 'object',
      properties: {
        minutes: {
          type: 'number',
          description: 'How many minutes of recent context to retrieve (default: 30)',
          default: 30,
        },
      },
      required: [],
    },
  },
  {
    name: 'search_context',
    description: 'Search through all Familiar-captured context for a keyword or phrase. Returns matching captures ordered by most recent.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search term or phrase to find in captured context',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_session_context',
    description: 'Get all captures from a specific Familiar session by session ID.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The session ID to retrieve context for',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'list_sessions',
    description: 'List recent Familiar capture sessions with their timestamps and capture counts.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of sessions to return (default: 10)',
          default: 10,
        },
      },
      required: [],
    },
  },
];

function sendResponse(id, result) {
  const response = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(response + '\n');
}

function sendError(id, code, message) {
  const response = JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
  process.stdout.write(response + '\n');
}

function callTool(name, args) {
  switch (name) {
    case 'get_recent_context':
      return getRecentContext(args);
    case 'search_context':
      return searchContext(args);
    case 'get_session_context':
      return getSessionContext(args);
    case 'list_sessions':
      return listSessions(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function handleMessage(message) {
  const { id, method, params } = message;

  try {
    switch (method) {
      case 'initialize':
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });
        break;

      case 'notifications/initialized':
        // No response needed for notifications
        break;

      case 'tools/list':
        sendResponse(id, { tools: TOOLS });
        break;

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        try {
          const text = callTool(toolName, toolArgs);
          sendResponse(id, {
            content: [{ type: 'text', text: String(text) }],
          });
        } catch (err) {
          sendError(id, -32603, err.message || 'Tool execution failed');
        }
        break;
      }

      case 'ping':
        sendResponse(id, {});
        break;

      default:
        if (id !== undefined) {
          sendError(id, -32601, `Method not found: ${method}`);
        }
    }
  } catch (err) {
    if (id !== undefined) {
      sendError(id, -32603, err.message || 'Internal error');
    }
  }
}

// Read newline-delimited JSON from stdin
let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // last potentially incomplete line
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const message = JSON.parse(trimmed);
      handleMessage(message);
    } catch (err) {
      process.stderr.write(`Failed to parse MCP message: ${err.message}\n`);
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  process.stderr.write(`Familiar MCP server error: ${err.message}\n`);
});
