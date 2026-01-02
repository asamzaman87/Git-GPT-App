// GitHub user type
export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url: string;
}

// Tool output types
export interface AuthStatusOutput {
  authenticated: boolean;
  authUrl?: string;
  user?: GitHubUser;
}

// PR Context Types (for code review)
export interface FileChange {
  filename: string;
  status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface PullRequestContext {
  pr: {
    id: number;
    number: number;
    title: string;
    state: "open" | "closed" | "merged";
    author: string;
    repository: {
      owner: string;
      name: string;
      fullName: string;
    };
    updatedAt: string;
    createdAt: string;
    htmlUrl: string;
    headSha: string;
    baseSha: string;
  };
  description: string;
  files: FileChange[];
  commits: number;
  baseRef: string;
  headRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeable?: boolean;
  mergeableState?: string;
  labels: Array<{ name: string; color: string }>;
  reviewers: Array<{ login: string; avatar_url: string }>;
}

export interface PRContextOutput {
  prContext?: PullRequestContext;
  authRequired?: boolean;
  authUrl?: string;
  error?: string;
}

// GitHub Pull Request types
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  draft: boolean;
  user: {
    login: string;
    avatar_url: string;
  };
  repository: {
    full_name: string;
    html_url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
}

export type PRSearchType =
  | "authored"
  | "reviewing"
  | "involved"
  | "user_authored";

export interface PullRequestsOutput {
  pullRequests?: GitHubPullRequest[];
  searchType?: PRSearchType;
  searchedUser?: string;
  totalCount?: number;
  authRequired?: boolean;
  authUrl?: string;
  error?: string;
}
