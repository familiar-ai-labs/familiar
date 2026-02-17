'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Database = require('better-sqlite3');

const { FAMILIAR_BEHIND_THE_SCENES_DIR_NAME, STILLS_DB_FILENAME } = require('../const');

function resolveDbPath(contextFolderPath) {
  return path.join(contextFolderPath, FAMILIAR_BEHIND_THE_SCENES_DIR_NAME, STILLS_DB_FILENAME);
}

function resolveMarkdownDir(contextFolderPath) {
  return path.join(contextFolderPath, FAMILIAR_BEHIND_THE_SCENES_DIR_NAME, 'stills-markdown');
}

// Verify that a path from the DB is within the expected markdown directory.
// Returns the resolved absolute path if safe, or null if it escapes the boundary.
function resolveMarkdownPath(markdownPath, contextFolderPath) {
  if (!markdownPath || typeof markdownPath !== 'string') return null;
  const markdownDir = resolveMarkdownDir(contextFolderPath);
  const resolved = path.resolve(markdownPath);
  return resolved.startsWith(markdownDir + path.sep) || resolved === markdownDir
    ? resolved
    : null;
}

function loadContextFolderPath() {
  try {
    const settingsPath = path.join(os.homedir(), '.familiar', 'settings.json');
    if (!fs.existsSync(settingsPath)) return null;
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    return typeof data.contextFolderPath === 'string' && data.contextFolderPath ? data.contextFolderPath : null;
  } catch {
    return null;
  }
}

function openDb(contextFolderPath) {
  const dbPath = resolveDbPath(contextFolderPath);
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true });
  db.pragma('journal_mode = WAL');
  return db;
}

// Tool: get_recent_context
// Returns markdown content from captures in the last N minutes
function getRecentContext({ minutes = 30 } = {}) {
  const contextFolderPath = loadContextFolderPath();
  if (!contextFolderPath) return 'Familiar context folder not configured.';

  const db = openDb(contextFolderPath);
  if (!db) return 'Familiar database not found. Has any context been captured?';

  try {
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const rows = db.prepare(`
      SELECT markdown_path, captured_at, session_id
      FROM stills_queue
      WHERE status = 'done' AND captured_at >= ?
      ORDER BY captured_at ASC
    `).all(since);

    if (rows.length === 0) return `No captured context found in the last ${minutes} minutes.`;

    const parts = [`# Familiar Context — Last ${minutes} minutes\n`];
    for (const row of rows) {
      if (!row.markdown_path) continue;
      const safePath = resolveMarkdownPath(row.markdown_path, contextFolderPath);
      if (!safePath) continue;
      try {
        const content = fs.readFileSync(safePath, 'utf-8');
        parts.push(`<!-- captured_at: ${row.captured_at} -->\n${content}`);
      } catch {
        // file missing, skip
      }
    }
    return parts.join('\n\n---\n\n') || `No readable context found in the last ${minutes} minutes.`;
  } finally {
    db.close();
  }
}

// Tool: search_context
// Full-text search over markdown content (file scan, pragmatic for local use)
function searchContext({ query = '' } = {}) {
  if (!query.trim()) return 'Query is required.';

  const contextFolderPath = loadContextFolderPath();
  if (!contextFolderPath) return 'Familiar context folder not configured.';

  const db = openDb(contextFolderPath);
  if (!db) return 'Familiar database not found.';

  try {
    const rows = db.prepare(`
      SELECT markdown_path, captured_at, session_id
      FROM stills_queue
      WHERE status = 'done' AND markdown_path IS NOT NULL
      ORDER BY captured_at DESC
      LIMIT 500
    `).all();

    const lowerQuery = query.toLowerCase();
    const matches = [];

    for (const row of rows) {
      if (!row.markdown_path) continue;
      const safePath = resolveMarkdownPath(row.markdown_path, contextFolderPath);
      if (!safePath) continue;
      try {
        const content = fs.readFileSync(safePath, 'utf-8');
        if (content.toLowerCase().includes(lowerQuery)) {
          matches.push({ content, capturedAt: row.captured_at });
          if (matches.length >= 10) break;
        }
      } catch {
        // skip unreadable files
      }
    }

    if (matches.length === 0) return `No context found matching: "${query}"`;

    const parts = [`# Search results for: "${query}" (${matches.length} matches)\n`];
    for (const match of matches) {
      parts.push(`<!-- captured_at: ${match.capturedAt} -->\n${match.content}`);
    }
    return parts.join('\n\n---\n\n');
  } finally {
    db.close();
  }
}

// Tool: get_session_context
// Returns all captures from a specific session
function getSessionContext({ session_id = '' } = {}) {
  if (!session_id) return 'session_id is required.';

  const contextFolderPath = loadContextFolderPath();
  if (!contextFolderPath) return 'Familiar context folder not configured.';

  const db = openDb(contextFolderPath);
  if (!db) return 'Familiar database not found.';

  try {
    const rows = db.prepare(`
      SELECT markdown_path, captured_at
      FROM stills_queue
      WHERE status = 'done' AND session_id = ?
      ORDER BY captured_at ASC
    `).all(session_id);

    if (rows.length === 0) return `No captures found for session: ${session_id}`;

    const parts = [`# Session context: ${session_id}\n`];
    for (const row of rows) {
      if (!row.markdown_path) continue;
      const safePath = resolveMarkdownPath(row.markdown_path, contextFolderPath);
      if (!safePath) continue;
      try {
        const content = fs.readFileSync(safePath, 'utf-8');
        parts.push(`<!-- captured_at: ${row.captured_at} -->\n${content}`);
      } catch {
        // skip
      }
    }
    return parts.join('\n\n---\n\n');
  } finally {
    db.close();
  }
}

// Tool: list_sessions
// Lists recent capture sessions with metadata
function listSessions({ limit = 10 } = {}) {
  const contextFolderPath = loadContextFolderPath();
  if (!contextFolderPath) return 'Familiar context folder not configured.';

  const db = openDb(contextFolderPath);
  if (!db) return 'Familiar database not found.';

  try {
    const rows = db.prepare(`
      SELECT
        session_id,
        MIN(captured_at) AS started_at,
        MAX(captured_at) AS last_capture_at,
        COUNT(*) AS total_captures,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS processed_captures
      FROM stills_queue
      GROUP BY session_id
      ORDER BY last_capture_at DESC
      LIMIT ?
    `).all(limit);

    if (rows.length === 0) return 'No sessions found.';

    const lines = ['# Recent Familiar Sessions\n'];
    for (const row of rows) {
      lines.push(
        `- **${row.session_id}**  \n` +
        `  Started: ${row.started_at}  \n` +
        `  Last capture: ${row.last_capture_at}  \n` +
        `  Captures: ${row.processed_captures}/${row.total_captures} processed`
      );
    }
    return lines.join('\n');
  } finally {
    db.close();
  }
}

module.exports = { getRecentContext, searchContext, getSessionContext, listSessions };
