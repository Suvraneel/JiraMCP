# Other MCP Clients

This page tracks additional AI clients that can often be connected to the same Jira MCP server.

Because MCP support changes quickly, treat this as a compatibility guide and verify in your installed version.

## Compatibility snapshot

| Client | MCP status | Typical setup path | Notes |
|---|---|---|---|
| Continue (VS Code / JetBrains) | Usually available | Extension settings or Continue config | Supports tool-style workflows; use stdio server definition. |
| Cline (VS Code) | Usually available | Extension MCP settings/config | Commonly used with local MCP servers. |
| Roo Code (VS Code) | Usually available | Extension settings/config | Similar setup model to Cline variants. |
| Windsurf | Version-dependent | In-app MCP/tools settings | Check current release docs for MCP toggle and config location. |
| OpenAI desktop/CLI ecosystems | Version-dependent | In-app tool settings or config file | MCP support differs across products/channels. |

## Reusable Jira server template

Use this template in any client that accepts a stdio MCP server entry:

```jsonc
{
  "jira": {
    "type": "stdio",
    "command": "node",
    "args": ["/absolute/path/to/JiraMCP/dist/server.js"],
    "env": {
      "JIRA_BASE_URL": "https://your-domain.atlassian.net",
      "JIRA_EMAIL": "your-email@example.com",
      "JIRA_API_TOKEN": "your-api-token-here"
    }
  }
}
```

## Validation checklist

- Server binary exists at `dist/server.js`.
- Client can launch stdio MCP servers.
- Environment variables are passed to the server process.
- Client is restarted after MCP config changes.
- A quick prompt works (for example: `Get the details of DEV-5`).

