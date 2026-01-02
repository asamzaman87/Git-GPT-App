# ChatGPT GitHub PR Reviewer

A ChatGPT app that helps you review **GitHub Pull Requests** directly from within ChatGPT conversations. Built using OpenAI's Apps SDK with the Model Context Protocol (MCP).

## Features

- **Connect GitHub** - OAuth login to connect your GitHub account
- **List Pull Requests** - View PRs you authored, need to review, or are involved in
- **Get PR Context** - Full PR details including files changed, diffs, and metadata
- **Post Comments** - Add general comments or inline comments on specific files/lines
- **Approve PRs** - Approve pull requests with optional comment
- **Request Changes** - Request changes with feedback
- **Idempotency Protection** - Prevents duplicate comments on retries
- **OAuth 2.1 Compliant** - Full MCP authorization spec with PKCE and discovery endpoints

---

## MCP Tools

### 1. `check_github_auth_status`

Connect and check GitHub authentication status.

**Input:** None

**Output (not authenticated):**
```json
{
  "authenticated": false,
  "authUrl": "https://github.com/login/oauth/authorize?..."
}
```

**Output (authenticated):**
```json
{
  "authenticated": true,
  "user": { "login": "username", "name": "Full Name" }
}
```

---

### 2. `list_pull_requests`

List pull requests with priority cascade.

**Input:**
```json
{
  "username": "octocat"  // Optional: filter by author
}
```

**Default behavior (no username):**
1. First shows PRs where YOU are the author
2. If none, shows PRs where you are a reviewer
3. If none, shows PRs where you are involved

**Output:**
```json
{
  "pullRequests": [...],
  "searchType": "authored" | "reviewing" | "involved" | "user_authored",
  "totalCount": 5
}
```

---

### 3. `get_pr_context`

Get full context for a PR including files changed and diffs.

**Input:**
```json
{
  "pr_name": "owner/repo#123"
}
```

**Output:**
```json
{
  "pr": { "number": 123, "title": "...", "author": "..." },
  "description": "PR description...",
  "files": [
    { "filename": "src/index.ts", "status": "modified", "additions": 10, "deletions": 5, "patch": "..." }
  ],
  "commits": 3,
  "additions": 50,
  "deletions": 20
}
```

---

### 4. `post_review_comments`

Post review comments to a PR. Supports general and inline comments.

**Input:**
```json
{
  "pr_name": "owner/repo#123",
  "comments": [
    { "body": "Looks good!" },
    { "body": "Use async here", "path": "src/index.ts", "line": 42 }
  ],
  "event": "COMMENT" | "APPROVE" | "REQUEST_CHANGES",
  "idempotency_key": "unique-key-123"
}
```

**Comment Types:**
- **General comment**: Only `body` - appears in PR conversation
- **Inline comment**: `body` + `path` + `line` - appears on specific line

**Output:**
```json
{
  "success": true,
  "reviewId": 12345,
  "prUrl": "https://github.com/owner/repo/pull/123",
  "commentsPosted": 2
}
```

---

## Example Prompts

### 1. Connect GitHub

| Prompt | Output |
|--------|--------|
| "Connect my GitHub" | Shows GitHub OAuth login button |
| "Login to GitHub" | Shows GitHub OAuth login button |

### 2. List Pull Requests

| Prompt | Output |
|--------|--------|
| "List my PRs" | Lists your PRs in priority: authored → reviewing → involved |
| "Show my PRs for review" | Lists PRs where you are a reviewer |
| "List m-musaz PRs" | Lists all open PRs by m-musaz |

### 3. Get PR Context

| Prompt | Output |
|--------|--------|
| "Review owner/repo#123" | Returns full PR details: title, description, files, diffs |
| "Get context for PR 123" | Returns full PR details with code changes |

### 4. Post Review Comments

| Prompt | Output |
|--------|--------|
| "Add comment: 'Looks good!'" | Posts general comment on PR |
| "Comment on line 42 of src/index.ts: 'Use async here'" | Posts inline comment |
| "Approve this PR" | Approves the PR |
| "Request changes: 'Please add tests'" | Requests changes with feedback |

---

## Project Structure

```
chatgpt-github-pr-reviewer/
├── package.json                 # Root package with npm workspaces
├── server/
│   └── src/
│       ├── index.ts             # Express server with OAuth endpoints
│       ├── mcp-server.ts        # MCP protocol handler
│       ├── mcp-oauth.ts         # OAuth 2.1 implementation
│       ├── github-auth.ts       # GitHub OAuth logic
│       ├── github-api.ts        # GitHub API integration
│       ├── idempotency-service.ts # Duplicate prevention
│       ├── token-store.ts       # GitHub token storage
│       └── types.ts             # TypeScript types
└── widget/
    └── src/
        ├── GitHubWidget.tsx     # Main widget component
        └── components/          # UI components
```

---

## Environment Variables

```env
# GitHub OAuth (from GitHub Developer Settings)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/github/callback

# Server
PORT=3000
NODE_ENV=development

# MCP OAuth (for ChatGPT authentication)
MCP_OAUTH_CLIENT_ID=chatgpt-mcp-client
MCP_OAUTH_CLIENT_SECRET=chatgpt-mcp-secret-key-2024

# Widget Base URL
WIDGET_BASE_URL=https://your-app.railway.app
```

---

## GitHub OAuth App Setup

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "OAuth Apps" → "New OAuth App"
3. Fill in:
   - **Application name**: ChatGPT PR Reviewer
   - **Homepage URL**: `https://your-app.railway.app`
   - **Authorization callback URL**: `https://your-app.railway.app/github/callback`
4. Copy **Client ID** and **Client Secret** to `.env`

### Step 2: Required Scopes

| Scope | Purpose |
|-------|---------|
| `read:user` | Read user profile |
| `read:org` | Read organization/team membership |
| `repo` | Full repository access (required for posting reviews) |

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your GitHub OAuth credentials

# Start development server
npm run dev
```

---

## Deployment

### Railway

1. Connect your GitHub repo to Railway
2. Add environment variables:
   ```
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_REDIRECT_URI=https://your-app.railway.app/github/callback
   PORT=3000
   NODE_ENV=production
   WIDGET_BASE_URL=https://your-app.railway.app
   ```

---

## ChatGPT Integration

1. Create a new ChatGPT App
2. Configure MCP:
   - **Discovery URL**: `https://your-app.railway.app/.well-known/oauth-authorization-server`
3. Test with: "Connect my GitHub" or "List my PRs"

---

## Credits

Built with:
- [OpenAI Apps SDK](https://platform.openai.com/docs/apps)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [GitHub REST API](https://docs.github.com/en/rest)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)

---

**Happy PR Reviewing!**
