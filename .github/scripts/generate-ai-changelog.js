import { execFileSync } from 'node:child_process';

const endpoint = 'https://ai-gateway.kilo.ai/api/v1/chat/completions';
const model = 'kilo-auto/free';

function git(args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

async function callKilo(prompt) {
  const token = process.env.KILO_API_KEY;
  if (!token) {
    throw new Error('KILO_API_KEY environment variable is not set.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Kilo Gateway error ${response.status}: ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Kilo Gateway returned non-JSON (${response.status}): ${text.slice(0, 500)}`);
  }

  const choice = data.choices?.[0];
  const finishReason = choice?.finish_reason ?? '';
  const content =
    choice?.message?.content ??
    choice?.message?.reasoning ??
    '';
  if (!content) {
    throw new Error(`Kilo Gateway returned empty content (status ${response.status}, body: ${text.slice(0, 500)})`);
  }
  if (finishReason && finishReason !== 'stop') {
    throw new Error(`Kilo Gateway did not complete generation (finish_reason: ${finishReason}); content may be truncated.`);
  }

  return content;
}

function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
      options.from = argv[++i];
    } else if (arg === '--to') {
      options.to = argv[++i];
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const from = options.from || process.env.COMMIT_FROM || '';
  const to = options.to || process.env.COMMIT_TO || 'HEAD';

  const range = from ? `${from}..${to}` : to;
  const subjects = git(['log', '--reverse', '--format=%s', range]).split('\n').filter(Boolean);
  if (subjects.length === 0) {
    throw new Error(`No commits were found in range ${range}.`);
  }

  const files = git(['diff', '--name-only', '--diff-filter=ACMRT', ...(from ? [from, to] : [to]), '--'])
    .split('\n')
    .filter(Boolean);

  const prompt = `You are a release manager for EasySupport, a self-hosted Discord ticketing bot (discord.js v14).

Generate a professional release changelog from the following Git commits:

Range: ${range}

Commit subjects:
${subjects.map((s) => `- ${s}`).join('\n')}

Changed files:
${files.map((f) => `- ${f}`).join('\n')}

Write the changelog in Markdown with:
1. A short summary paragraph describing the release.
2. Categorized change lists: Features, Fixes, Improvements, Documentation, Maintenance, Other. Only include categories that have changes.
3. A "Changed files" section listing the modified paths.
4. Note any breaking changes explicitly.

Keep it concise and developer-friendly. Do not include commit hashes.`;

  const changelog = await callKilo(prompt);
  process.stdout.write(changelog);
}

main().catch((error) => {
  console.error(`[generate-ai-changelog] ${error.message}`);
  process.exitCode = 1;
});
