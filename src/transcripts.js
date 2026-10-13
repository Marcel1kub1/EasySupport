import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/* Plain-text transcript, attached to the closure DM. */
export function buildTranscriptText(ticket, messages) {
  const lines = [
    `Ticket #${ticket.id} — ${ticket.category}`,
    `Opened by: ${ticket.user_tag} (${ticket.user_id})`,
    `Opened at: ${ticket.opened_at}`,
    `Closed at: ${ticket.closed_at ?? 'n/a'}`,
    `Closed by staff: ${ticket.claimed_by ?? 'unclaimed'}`,
    `Reason: ${ticket.close_reason ?? 'none given'}`,
    '-'.repeat(48),
  ];
  for (const m of messages) {
    lines.push(`[${m.created_at}] ${m.author_tag}: ${m.content}`);
  }
  return lines.join('\n');
}

/* Minimal, dependency-free HTML transcript. */
export function buildTranscriptHtml(ticket, messages) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const rows = messages
    .map(
      (m) => `<tr>
  <td class="time">${esc(m.created_at)}</td>
  <td class="author">${esc(m.author_tag)}</td>
  <td class="content">${esc(m.content)}</td>
</tr>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Transcript — Ticket #${esc(ticket.id)}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1e1f22; color: #dbdee1; margin: 2rem; }
  h1 { font-size: 1.25rem; }
  table { border-collapse: collapse; width: 100%; }
  td { border-bottom: 1px solid #2b2d31; padding: 6px 8px; vertical-align: top; font-size: 0.85rem; }
  .time { color: #949ba4; white-space: nowrap; }
  .author { color: #5865f2; white-space: nowrap; }
  .meta { color: #949ba4; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>Ticket #${esc(ticket.id)} — ${esc(ticket.category)}</h1>
<p class="meta">
  Opened by ${esc(ticket.user_tag)} · ${esc(ticket.opened_at)}<br>
  Closed ${esc(ticket.closed_at ?? 'n/a')} · Claimed by ${esc(ticket.claimed_by ?? 'nobody')}<br>
  Reason: ${esc(ticket.close_reason ?? 'none given')}
</p>
<table>
${rows}
</table>
</body>
</html>`;
}

/* Writes both transcript formats to disk and returns their paths. */
export function saveTranscripts(ticket, messages) {
  fs.mkdirSync(config.transcriptDir, { recursive: true });
  const textPath = path.join(config.transcriptDir, `ticket-${ticket.id}.txt`);
  const htmlPath = path.join(config.transcriptDir, `ticket-${ticket.id}.html`);
  fs.writeFileSync(textPath, buildTranscriptText(ticket, messages));
  fs.writeFileSync(htmlPath, buildTranscriptHtml(ticket, messages));
  return { textPath, htmlPath };
}
