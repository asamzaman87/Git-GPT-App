import pg from 'pg';
import {
  GitHubTokens,
  GitHubUser,
  StoredGitHubTokenData,
} from './types.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool
 */
function getPool(): pg.Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Required for Railway/Heroku
      } : undefined,
      max: 20, // Maximum connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
    
    console.log('GitHub tokens PostgreSQL connection pool initialized');
  }
  
  return pool;
}

// ============================================
// GitHub Token Storage Functions (PostgreSQL)
// ============================================

/**
 * Save GitHub tokens for a user
 */
export async function saveGitHubTokens(userId: string, tokens: GitHubTokens, user: GitHubUser): Promise<void> {
  const pool = getPool();
  
  try {
    await pool.query(`
      INSERT INTO github_oauth_tokens (
        user_id, access_token, token_type, scope,
        github_user_id, github_login, github_name, github_email, github_avatar_url,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        github_user_id = EXCLUDED.github_user_id,
        github_login = EXCLUDED.github_login,
        github_name = EXCLUDED.github_name,
        github_email = EXCLUDED.github_email,
        github_avatar_url = EXCLUDED.github_avatar_url,
        updated_at = NOW()
    `, [
      userId,
      tokens.access_token,
      tokens.token_type,
      tokens.scope,
      user.id,
      user.login,
      user.name || null,
      user.email || null,
      user.avatar_url
    ]);
    
    console.log(`GitHub tokens saved for user: ${userId} (${user.login})`);
  } catch (error) {
    console.error('Error saving GitHub tokens:', error);
    throw error;
  }
}

/**
 * Get GitHub tokens for a user
 */
export async function getGitHubTokens(userId: string): Promise<StoredGitHubTokenData | null> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT * FROM github_oauth_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      tokens: {
        access_token: row.access_token,
        token_type: row.token_type,
        scope: row.scope,
      },
      user: {
        id: row.github_user_id,
        login: row.github_login,
        name: row.github_name || undefined,
        email: row.github_email || undefined,
        avatar_url: row.github_avatar_url,
      },
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  } catch (error) {
    console.error('Error getting GitHub tokens:', error);
    throw error;
  }
}

/**
 * Delete GitHub tokens for a user
 */
export async function deleteGitHubTokens(userId: string): Promise<boolean> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'DELETE FROM github_oauth_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`GitHub tokens deleted for user: ${userId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting GitHub tokens:', error);
    throw error;
  }
}

/**
 * Check if user has GitHub tokens
 */
export async function hasGitHubTokens(userId: string): Promise<boolean> {
  const data = await getGitHubTokens(userId);
  return !!data && !!data.tokens && !!data.tokens.access_token;
}

/**
 * Get GitHub user by login (for looking up)
 */
export async function getUserIdByGitHubLogin(login: string): Promise<string | null> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT user_id FROM github_oauth_tokens WHERE github_login = $1',
      [login]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].user_id;
  } catch (error) {
    console.error('Error looking up user by GitHub login:', error);
    throw error;
  }
}

/**
 * Close the database connection pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('GitHub tokens PostgreSQL connection pool closed');
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing GitHub tokens database connections...');
  await closePool();
  process.exit(0);
});


