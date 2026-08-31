# MCP Setup (optional)

Document-only — do not commit secrets.

## Recommended MCP servers

| Server | Use |
|--------|-----|
| cursor-ide-browser | Portal E2E smoke per role |
| GitHub | PR checks, issues (token via env) |

## Example `.cursor/mcp.json` (local only)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<from-env>"
      }
    }
  }
}
```

Add `.cursor/mcp.json` to `.gitignore` if it contains tokens.
