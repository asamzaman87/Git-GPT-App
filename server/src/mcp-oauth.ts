/**
 * OAuth 2.1 implementation for ChatGPT MCP authentication
 * Supports:
 * - Client Credentials flow
 * - Authorization Code flow with PKCE
 * - Dynamic Client Registration (RFC 7591)
 */

import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool for MCP OAuth
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
        rejectUnauthorized: false
      } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle MCP OAuth PostgreSQL client', err);
    });
    
    console.log('MCP OAuth PostgreSQL connection pool initialized');
  }
  
  return pool;
}

// ============================================
// Types
// ============================================

interface RegisteredClient {
  client_id: string;
  client_secret: string;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  created_at: number;
}

interface IssuedToken {
  expiresAt: number;
  clientId: string;
  scope?: string;
  refreshToken?: string; // Link to refresh token
  resource?: string; // Resource parameter (audience)
}

interface RefreshToken {
  expiresAt: number;
  clientId: string;
  scope?: string;
  accessToken?: string; // Currently linked access token
  resource?: string; // Resource parameter (audience)
}

interface AuthorizationCode {
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: number;
  scope?: string;
  resource?: string; // Resource parameter (audience)
}

// ============================================
// Storage Configuration (PostgreSQL)
// ============================================

// Token expiration time (1 hour)
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

// Refresh token expiration (30 days)
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Auth code expiration (10 minutes)
const AUTH_CODE_EXPIRY_MS = 10 * 60 * 1000;

// ============================================
// Default/Fallback Client
// ============================================

/**
 * Get default OAuth credentials from environment variables
 */
export function getOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MCP_OAUTH_CLIENT_ID || 'chatgpt-mcp-client';
  const clientSecret = process.env.MCP_OAUTH_CLIENT_SECRET || 'chatgpt-mcp-secret-key-2024';
  return { clientId, clientSecret };
}

// Initialize default client (async, called from server startup)
export async function initializeDefaultClient(): Promise<void> {
  const pool = getPool();
  const { clientId, clientSecret } = getOAuthCredentials();
  
  try {
    await pool.query(`
      INSERT INTO mcp_oauth_clients (
        client_id, client_secret, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (client_id) DO UPDATE SET
        client_secret = EXCLUDED.client_secret,
        client_name = EXCLUDED.client_name,
        redirect_uris = EXCLUDED.redirect_uris,
        grant_types = EXCLUDED.grant_types,
        response_types = EXCLUDED.response_types,
        token_endpoint_auth_method = EXCLUDED.token_endpoint_auth_method
    `, [
      clientId,
      clientSecret,
      'Default MCP Client',
      ['https://chatgpt.com/aip/g-*/oauth/callback', 'https://chatgpt.com/connector_platform_oauth_redirect', 'https://platform.openai.com/apps-manage/oauth'],
      ['authorization_code', 'client_credentials', 'refresh_token'],
      ['code'],
      'client_secret_post'
    ]);
    
    console.log(`Default MCP OAuth client initialized: ${clientId}`);
  } catch (error) {
    console.error('Error initializing default MCP client:', error);
    throw error;
  }
}

// ============================================
// Dynamic Client Registration (RFC 7591)
// ============================================

export interface ClientRegistrationRequest {
  client_name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  scope?: string;
}

export interface ClientRegistrationResponse {
  client_id: string;
  client_secret: string;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
}

/**
 * Register a new OAuth client dynamically
 */
export async function registerClient(request: ClientRegistrationRequest): Promise<ClientRegistrationResponse> {
  const pool = getPool();
  const clientId = `client_${crypto.randomBytes(16).toString('hex')}`;
  const clientSecret = crypto.randomBytes(32).toString('hex');
  
  const clientName = request.client_name || 'Dynamic Client';
  const redirectUris = request.redirect_uris || ['https://chatgpt.com/aip/g-*/oauth/callback'];
  const grantTypes = request.grant_types || ['authorization_code'];
  const responseTypes = request.response_types || ['code'];
  const tokenEndpointAuthMethod = request.token_endpoint_auth_method || 'client_secret_post';
  
  try {
    const result = await pool.query(`
      INSERT INTO mcp_oauth_clients (
        client_id, client_secret, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING created_at
    `, [clientId, clientSecret, clientName, redirectUris, grantTypes, responseTypes, tokenEndpointAuthMethod]);
    
    console.log(`Registered new OAuth client: ${clientId}`);
    
    return {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      client_id_issued_at: Math.floor(new Date(result.rows[0].created_at).getTime() / 1000),
      client_secret_expires_at: 0, // Never expires
    };
  } catch (error) {
    console.error('Error registering OAuth client:', error);
    throw error;
  }
}

/**
 * Get a registered client by ID
 */
export async function getClient(clientId: string): Promise<RegisteredClient | undefined> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT * FROM mcp_oauth_clients WHERE client_id = $1',
      [clientId]
    );
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const row = result.rows[0];
    return {
      client_id: row.client_id,
      client_secret: row.client_secret,
      client_name: row.client_name,
      redirect_uris: row.redirect_uris,
      grant_types: row.grant_types,
      response_types: row.response_types,
      token_endpoint_auth_method: row.token_endpoint_auth_method,
      created_at: new Date(row.created_at).getTime(),
    };
  } catch (error) {
    console.error('Error getting OAuth client:', error);
    throw error;
  }
}

// ============================================
// Client Validation
// ============================================

/**
 * Validate client credentials
 */
export async function validateClientCredentials(clientId: string, clientSecret: string): Promise<boolean> {
  const client = await getClient(clientId);
  if (client) {
    return client.client_secret === clientSecret;
  }
  
  // Fallback to env-based credentials
  const { clientId: envId, clientSecret: envSecret } = getOAuthCredentials();
  return clientId === envId && clientSecret === envSecret;
}

/**
 * Validate client exists (for auth code flow without secret)
 */
export async function validateClientId(clientId: string): Promise<boolean> {
  const client = await getClient(clientId);
  if (client) {
    return true;
  }
  const { clientId: envId } = getOAuthCredentials();
  return clientId === envId;
}

// ============================================
// Authorization Codes (for PKCE flow)
// ============================================

/**
 * Generate an authorization code
 */
export async function generateAuthorizationCode(
  clientId: string,
  redirectUri: string,
  codeChallenge?: string,
  codeChallengeMethod?: string,
  scope?: string,
  resource?: string
): Promise<string> {
  const pool = getPool();
  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);
  
  try {
    await pool.query(`
      INSERT INTO mcp_auth_codes (
        code, client_id, redirect_uri, code_challenge, code_challenge_method, expires_at, scope, resource
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [code, clientId, redirectUri, codeChallenge || null, codeChallengeMethod || null, expiresAt, scope || null, resource || null]);
    
    return code;
  } catch (error) {
    console.error('Error generating authorization code:', error);
    throw error;
  }
}

/**
 * Validate and consume an authorization code
 */
export async function validateAuthorizationCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{ valid: boolean; error?: string; scope?: string; resource?: string }> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT * FROM mcp_auth_codes WHERE code = $1',
      [code]
    );
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid authorization code' };
    }
    
    const authCode = result.rows[0];
    
    // Check expiration
    if (new Date() > new Date(authCode.expires_at)) {
      await pool.query('DELETE FROM mcp_auth_codes WHERE code = $1', [code]);
      return { valid: false, error: 'Authorization code expired' };
    }
    
    // Check client ID
    if (authCode.client_id !== clientId) {
      return { valid: false, error: 'Client ID mismatch' };
    }
    
    // Check redirect URI
    if (authCode.redirect_uri !== redirectUri) {
      return { valid: false, error: 'Redirect URI mismatch' };
    }
    
    // Validate PKCE if code challenge was provided
    if (authCode.code_challenge && authCode.code_challenge_method === 'S256') {
      if (!codeVerifier) {
        return { valid: false, error: 'Code verifier required' };
      }
      
      const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      if (hash !== authCode.code_challenge) {
        return { valid: false, error: 'Invalid code verifier' };
      }
    }
    
    // Consume the code (one-time use)
    await pool.query('DELETE FROM mcp_auth_codes WHERE code = $1', [code]);
    
    return { valid: true, scope: authCode.scope, resource: authCode.resource };
  } catch (error) {
    console.error('Error validating authorization code:', error);
    throw error;
  }
}

// ============================================
// Access Tokens & Refresh Tokens
// ============================================

/**
 * Generate an access token (legacy - for backward compatibility)
 */
export async function generateAccessToken(clientId: string, scope?: string, resource?: string): Promise<string> {
  const { accessToken } = await generateTokenPair(clientId, scope, resource);
  return accessToken;
}

/**
 * Generate both access token and refresh token
 */
export async function generateTokenPair(
  clientId: string, 
  scope?: string,
  resource?: string
): Promise<{ 
  accessToken: string; 
  refreshToken: string;
}> {
  const pool = getPool();
  const accessToken = crypto.randomBytes(32).toString('hex');
  const refreshToken = crypto.randomBytes(32).toString('hex');
  
  const accessExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
  
  try {
    // Store access token with link to refresh token
    await pool.query(`
      INSERT INTO mcp_access_tokens (token, client_id, expires_at, scope, resource, refresh_token)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [accessToken, clientId, accessExpiresAt, scope || null, resource || null, refreshToken]);
    
    // Store refresh token with link to access token
    await pool.query(`
      INSERT INTO mcp_refresh_tokens (token, client_id, expires_at, scope, resource, access_token)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [refreshToken, clientId, refreshExpiresAt, scope || null, resource || null, accessToken]);
    
    // Clean up expired tokens periodically
    await cleanupExpiredTokens();
    
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Error generating token pair:', error);
    throw error;
  }
}

/**
 * Validate an access token
 */
export async function validateAccessToken(token: string): Promise<boolean> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT expires_at FROM mcp_access_tokens WHERE token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const expiresAt = new Date(result.rows[0].expires_at);
    if (new Date() > expiresAt) {
      await pool.query('DELETE FROM mcp_access_tokens WHERE token = $1', [token]);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating access token:', error);
    return false;
  }
}

/**
 * Validate a refresh token and return its data
 */
export async function validateRefreshToken(token: string): Promise<{ 
  valid: boolean; 
  clientId?: string; 
  scope?: string;
  resource?: string;
  error?: string;
}> {
  const pool = getPool();
  
  try {
    const result = await pool.query(
      'SELECT * FROM mcp_refresh_tokens WHERE token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid refresh token' };
    }
    
    const tokenData = result.rows[0];
    const expiresAt = new Date(tokenData.expires_at);
    
    if (new Date() > expiresAt) {
      await pool.query('DELETE FROM mcp_refresh_tokens WHERE token = $1', [token]);
      return { valid: false, error: 'Refresh token expired' };
    }
    
    return { 
      valid: true, 
      clientId: tokenData.client_id, 
      scope: tokenData.scope,
      resource: tokenData.resource
    };
  } catch (error) {
    console.error('Error validating refresh token:', error);
    return { valid: false, error: 'Database error' };
  }
}

/**
 * Revoke a refresh token and its linked access token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const pool = getPool();
  
  try {
    // Get the linked access token
    const result = await pool.query(
      'SELECT access_token FROM mcp_refresh_tokens WHERE token = $1',
      [token]
    );
    
    if (result.rows.length > 0 && result.rows[0].access_token) {
      // Revoke the linked access token
      await pool.query('DELETE FROM mcp_access_tokens WHERE token = $1', [result.rows[0].access_token]);
    }
    
    // Revoke the refresh token
    await pool.query('DELETE FROM mcp_refresh_tokens WHERE token = $1', [token]);
  } catch (error) {
    console.error('Error revoking refresh token:', error);
    throw error;
  }
}

/**
 * Clean up expired tokens
 */
async function cleanupExpiredTokens(): Promise<void> {
  const pool = getPool();
  const now = new Date();
  
  try {
    // Clean up expired access tokens
    await pool.query('DELETE FROM mcp_access_tokens WHERE expires_at < $1', [now]);
    
    // Clean up expired refresh tokens
    await pool.query('DELETE FROM mcp_refresh_tokens WHERE expires_at < $1', [now]);
    
    // Clean up expired auth codes
    await pool.query('DELETE FROM mcp_auth_codes WHERE expires_at < $1', [now]);
  } catch (error) {
    // Log but don't throw - cleanup is not critical
    console.error('Error cleaning up expired tokens:', error);
  }
}

// ============================================
// Utilities
// ============================================

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Get token response (with refresh token)
 */
export function getTokenResponse(
  accessToken: string, 
  refreshToken: string,
  scope?: string
): {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope?: string;
} {
  const response: any = {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(TOKEN_EXPIRY_MS / 1000),
    refresh_token: refreshToken,
  };
  
  if (scope) {
    response.scope = scope;
  }
  
  return response;
}

// ============================================
// Connection Management
// ============================================

/**
 * Close the database connection pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('MCP OAuth PostgreSQL connection pool closed');
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing MCP OAuth database connections...');
  await closePool();
});
