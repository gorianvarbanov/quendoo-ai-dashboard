# Claude API Integration Setup Guide

## Overview

Your MCP client now supports **intelligent tool calling** powered by Claude! Claude will:
- ✅ Understand user queries in natural language
- ✅ Automatically decide which MCP tools to use
- ✅ Execute tools and combine results
- ✅ Generate helpful responses with context

## Setup Steps

### 1. Get Your Anthropic API Key

1. Visit https://console.anthropic.com/
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)

### 2. Configure the API Key

Edit `backend/mcp-client/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

**Important**: Replace `your-api-key-here` with your actual API key!

### 3. Restart the MCP Client

```bash
# Stop the current MCP client (Ctrl+C)
# Then restart it:
cd "c:\Quendoo AI Dashboard\backend\mcp-client"
npm run dev
```

You should see: `Claude API integration enabled`

### 4. Test It!

Open http://localhost:3002 and try these queries:

**Example 1: List files**
```
"List all the files in the current directory"
```

Claude will:
- Recognize you want to see files
- Call the `list_directory` tool
- Return a formatted list

**Example 2: Read a file**
```
"Read the README.md file and summarize it"
```

Claude will:
- Call `read_text_file` with path "README.md"
- Summarize the contents for you

**Example 3: Search files**
```
"Find all JavaScript files in the src folder"
```

Claude will:
- Call `search_files` with pattern "*.js"
- List all matching files

**Example 4: Complex workflow**
```
"Show me all the package.json files and tell me what dependencies they have"
```

Claude will:
- Search for package.json files
- Read each one
- Extract and summarize dependencies

## How It Works

### Without Claude API (Before)
```
User: "List files"
  ↓
Response: "MCP Client received your message. Claude API integration pending."
```

### With Claude API (Now!)
```
User: "List files in the current directory"
  ↓
Claude analyzes: "User wants file listing"
  ↓
Claude calls: list_directory tool with path "."
  ↓
Tool executes and returns results
  ↓
Claude formats: "Here are the files in the current directory:
  - README.md
  - package.json
  - src/
  - ..."
```

## Architecture

```
User Message
     ↓
Frontend (Vue)
     ↓
PHP Backend
     ↓
MCP Client (Node.js)
     ↓
Claude API ← Analyzes message
     ↓       ← Decides which tools to use
     ↓
MCP Servers ← Executes tools
     ↓
Results flow back through Claude
     ↓
Intelligent response to user
```

## Example Conversation

**User**: "What files are in the backend folder?"

**Claude thinks**:
- User wants to list directory contents
- Tool: `list_directory`
- Arguments: `{ path: "backend" }`

**Claude executes**: `list_directory("backend")`

**Tool returns**:
```
[FILE] composer.json
[DIR] src
[DIR] mcp-client
[FILE] .env
```

**Claude responds**:
"The backend folder contains:
- composer.json (PHP dependencies)
- src/ (source code directory)
- mcp-client/ (Node.js MCP client)
- .env (environment configuration)"

## Available Tools

With the filesystem server connected, Claude can:

### File Reading
- `read_text_file` - Read file contents
- `read_multiple_files` - Read several files at once
- `read_media_file` - Read images/audio

### File Writing
- `write_file` - Create or overwrite files
- `edit_file` - Make line-based edits

### Directory Operations
- `list_directory` - List files/folders
- `list_directory_with_sizes` - List with file sizes
- `directory_tree` - Recursive tree view
- `create_directory` - Create folders

### File Management
- `move_file` - Move or rename
- `search_files` - Find files by pattern
- `get_file_info` - File metadata

## Natural Language Examples

Try asking Claude in natural language:

- "Show me what's in the src folder"
- "Read the package.json and tell me what version we're on"
- "Find all TypeScript files"
- "Create a new folder called 'test'"
- "What's the size of the README file?"
- "Search for files containing the word 'MCP'"

Claude will understand your intent and use the appropriate tools!

## Conversation Memory

Claude maintains conversation history, so you can have context-aware discussions:

```
You: "List the files in src/"
Claude: [Lists files including index.js, mcpClientManager.js, claudeIntegration.js]

You: "Read the first one"
Claude: [Knows you mean index.js, reads it]

You: "What does it do?"
Claude: [Explains based on the file content it just read]
```

## Cost Considerations

Claude API charges by tokens:
- Input: $3 per million tokens
- Output: $15 per million tokens

**Typical conversation costs**:
- Simple query: ~$0.001-0.003
- Complex tool usage: ~$0.01-0.05

**Monthly estimates**:
- 100 queries/day: ~$3-10/month
- 500 queries/day: ~$15-50/month

See pricing: https://www.anthropic.com/pricing

## Troubleshooting

### Error: "Claude API key not configured"

**Solution**: Add your API key to `backend/mcp-client/.env` and restart

### Error: "Tool not found"

**Solution**: Make sure MCP server is connected:
```bash
curl http://localhost:3100/servers
```

### Claude doesn't use tools

**Issue**: Claude might respond without calling tools if:
- The query doesn't clearly need tools
- No appropriate tool is available

**Try**: Be more specific in your request
- Bad: "Tell me about files"
- Good: "List all files in the current directory"

### API Rate Limits

If you hit rate limits:
- Claude 3.5 Sonnet: 50 requests/minute
- Add delays between requests if needed

## Advanced Usage

### System Prompts (Future Enhancement)

You could add system prompts to guide Claude's behavior:

```javascript
// In claudeIntegration.js, add to message history:
{
  role: 'system',
  content: 'You are a helpful file system assistant. Always be concise and use tools when appropriate.'
}
```

### Multi-Tool Workflows

Claude can chain multiple tools:

```
User: "Find all JSON files and count how many there are"

Claude will:
1. Call search_files(".", "*.json")
2. Count the results
3. Respond with the total
```

### Tool Caching (Future)

For better performance, you could cache tool results:
- List directory → cache for 5 minutes
- Read file → cache until file modified

## Security Notes

⚠️ **Important Security Considerations**:

1. **API Key Protection**: Never commit your API key to version control
2. **File Access**: Filesystem server is restricted to allowed directories
3. **User Input**: Claude validates all tool inputs
4. **Rate Limiting**: Consider adding rate limits for production

## Next Steps

1. ✅ Get API key from Anthropic
2. ✅ Configure `.env` file
3. ✅ Restart MCP client
4. ✅ Test with natural language queries
5. 🔄 Connect more MCP servers (GitHub, Memory, etc.)
6. 🔄 Build UI for server management
7. 🔄 Add conversation export/import

## Support

- Anthropic Docs: https://docs.anthropic.com/
- MCP Docs: https://modelcontextprotocol.io/
- Claude API Console: https://console.anthropic.com/

Enjoy your intelligent AI assistant! 🎉
