/**
 * Lightweight Markdown Parser
 *
 * Parses a subset of markdown syntax for chat messages
 * Does NOT use external libraries to keep bundle size small
 */

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * Removes potentially dangerous content while preserving safe formatting
 * Currently not used as we escape HTML before parsing markdown,
 * but kept for future rich content support
 */
export function sanitizeHTML(html: string): string {
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.textContent = html;
  let sanitized = temp.innerHTML;

  // Allow specific safe tags
  const allowedTags = ['strong', 'em', 'code', 'blockquote', 'a', 'br'];
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

  sanitized = sanitized.replace(tagPattern, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match;
    }
    return ''; // Remove disallowed tags
  });

  return sanitized;
}

/**
 * Parse markdown text to HTML
 *
 * Supported syntax:
 * - **bold**
 * - *italic*
 * - `code`
 * - > quote
 * - [link](url)
 */
export function parseMarkdown(text: string): string {
  let parsed = text;

  // Escape HTML first
  parsed = parsed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text**
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (but not if it's part of **)
  parsed = parsed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Code: `text`
  parsed = parsed.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Blockquote: > text (at start of line)
  parsed = parsed.replace(/^&gt;\s(.+)$/gm, '<blockquote>$1</blockquote>');

  // Links: [text](url)
  parsed = parsed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Line breaks: \n to <br>
  parsed = parsed.replace(/\n/g, '<br>');

  return parsed;
}

/**
 * Strip markdown formatting (for plain text display)
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')     // Bold
    .replace(/\*([^*]+)\*/g, '$1')         // Italic
    .replace(/`([^`]+)`/g, '$1')           // Code
    .replace(/^>\s(.+)$/gm, '$1')          // Blockquote
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
}

/**
 * Check if text contains markdown
 */
export function hasMarkdown(text: string): boolean {
  return (
    /\*\*[^*]+\*\*/.test(text) ||  // Bold
    /\*[^*]+\*/.test(text) ||      // Italic
    /`[^`]+`/.test(text) ||        // Code
    /^>\s.+$/m.test(text) ||       // Blockquote
    /\[[^\]]+\]\([^)]+\)/.test(text) // Links
  );
}

/**
 * Parse @mentions in text
 *
 * Converts @Username to clickable mention spans
 */
export function parseMentions(
  text: string,
  players: Array<{ id: string; name: string }>,
): {
  html: string;
  mentionedIds: string[];
} {
  const mentions: string[] = [];

  const html = text.replace(/@(\w+)/g, (match, username) => {
    // Find player (case-insensitive)
    const player = players.find(
      (p) => p.name.toLowerCase() === username.toLowerCase(),
    );

    if (player) {
      mentions.push(player.id);
      return `<span class="mention" data-user-id="${player.id}">@${player.name}</span>`;
    }

    return match; // Not a valid mention
  });

  return {
    html,
    mentionedIds: mentions,
  };
}
