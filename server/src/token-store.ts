import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GitHubTokens,
  GitHubUser,
  StoredGitHubTokenData,
  GitHubTokenStore,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Token storage file paths
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const GITHUB_TOKENS_FILE = path.join(DATA_DIR, 'github-tokens.json');

/**
 * Ensure the data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ============================================
// GitHub Token Storage Functions
// ============================================

/**
 * Read the GitHub token store from disk
 */
function readGitHubTokenStore(): GitHubTokenStore {
  ensureDataDir();

  if (!fs.existsSync(GITHUB_TOKENS_FILE)) {
    return {};
  }

  try {
    const data = fs.readFileSync(GITHUB_TOKENS_FILE, 'utf-8');
    return JSON.parse(data) as GitHubTokenStore;
  } catch (error) {
    console.error('Error reading GitHub token store:', error);
    return {};
  }
}

/**
 * Write the GitHub token store to disk
 */
function writeGitHubTokenStore(store: GitHubTokenStore): void {
  ensureDataDir();

  try {
    fs.writeFileSync(GITHUB_TOKENS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing GitHub token store:', error);
    throw error;
  }
}

/**
 * Save GitHub tokens for a user
 */
export function saveGitHubTokens(userId: string, tokens: GitHubTokens, user: GitHubUser): void {
  const store = readGitHubTokenStore();
  const now = new Date().toISOString();

  store[userId] = {
    tokens,
    user,
    createdAt: store[userId]?.createdAt || now,
    updatedAt: now,
  };

  writeGitHubTokenStore(store);
  console.log(`GitHub tokens saved for user: ${userId} (${user.login})`);
}

/**
 * Get GitHub tokens for a user
 */
export function getGitHubTokens(userId: string): StoredGitHubTokenData | null {
  const store = readGitHubTokenStore();
  return store[userId] || null;
}

/**
 * Delete GitHub tokens for a user
 */
export function deleteGitHubTokens(userId: string): boolean {
  const store = readGitHubTokenStore();

  if (store[userId]) {
    delete store[userId];
    writeGitHubTokenStore(store);
    console.log(`GitHub tokens deleted for user: ${userId}`);
    return true;
  }

  return false;
}

/**
 * Check if user has GitHub tokens
 */
export function hasGitHubTokens(userId: string): boolean {
  const data = getGitHubTokens(userId);
  return !!data && !!data.tokens && !!data.tokens.access_token;
}

/**
 * Get GitHub user by login (for looking up)
 */
export function getUserIdByGitHubLogin(login: string): string | null {
  const store = readGitHubTokenStore();

  for (const [userId, data] of Object.entries(store)) {
    if (data.user.login === login) {
      return userId;
    }
  }

  return null;
}
