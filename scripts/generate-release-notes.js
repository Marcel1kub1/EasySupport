import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(projectRoot, 'src', 'data');
const rulesPath = path.join(projectRoot, 'scripts', 'release-notes.rules.json');
const feedPath = path.join(dataDirectory, 'releases.json');
const markdownPath = path.join(dataDirectory, 'releases.md');

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!['--from', '--to', '--version', '--title', '--date'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Expected a value after ${argument}`);
    options[argument.slice(2)] = value;
    index += 1;
  }
  if (!options.from) throw new Error('Provide the previous release ref with --from.');
  if (!options.version) throw new Error('Provide the release version with --version.');
  if (options.from.startsWith('-') || (options.to && options.to.startsWith('-'))) {
    throw new Error('Git refs cannot start with a hyphen.');
  }
  return { ...options, to: options.to || 'HEAD' };
}

function git(argumentsList) {
  return execFileSync('git', argumentsList, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function commandString(source, method) {
  const pattern = new RegExp(String.raw`\.set${method}\(\s*(['"])((?:\\.|(?!\1)[\s\S])*)\1\s*\)`);
  const match = source.match(pattern);
  return match?.[2]?.replaceAll("\\'", "'").replaceAll('\\"', '"') ?? null;
}

function categorize(subject, rules) {
  const match = subject.match(/^([a-z]+)(?:\([^)]*\))?(!)?:\s*(.+)$/i);
  if (!match) return { category: rules.otherCategory, entry: subject };
  if (match[2]) return { category: rules.breakingCategory, entry: match[3] };
  return { category: rules.prefixes[match[1].toLowerCase()] ?? rules.otherCategory, entry: match[3] };
}

function markdownFor(release) {
  const sections = [
    `# ${release.title}`,
    '',
    `Version: ${release.version}`,
    `Date: ${release.date}`,
    '',
    release.summary,
    '',
  ];

  for (const [category, entries] of Object.entries(release.changes)) {
    if (!entries.length) continue;
    sections.push(`## ${category}`, '', ...entries.map((entry) => `- ${entry}`), '');
  }

  if (release.commands.length) {
    sections.push('## Command updates', '');
    for (const command of release.commands) sections.push(`- \`/${command.name}\` — ${command.description}`);
    sections.push('');
  }

  if (release.files.length) {
    sections.push('## Changed files', '', ...release.files.map((file) => `- \`${file}\``), '');
  }

  sections.push(`Generated from \`${release.source.from}..${release.source.to}\`. Review these factual notes before publishing.`);
  return `${sections.join('\n')}\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const rules = JSON.parse(await readFile(rulesPath, 'utf8'));
  const packageData = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const range = `${options.from}..${options.to}`;
  const subjects = git(['log', '--reverse', '--format=%s', range]).split('\n').filter(Boolean);
  if (subjects.length === 0) throw new Error(`No commits were found in ${range}.`);

  const files = git(['diff', '--name-only', '--diff-filter=ACMRT', options.from, options.to, '--'])
    .split('\n')
    .filter(Boolean);
  const changes = {};
  for (const subject of subjects) {
    const { category, entry } = categorize(subject, rules);
    changes[category] ??= [];
    if (!changes[category].includes(entry)) changes[category].push(entry);
  }

  const commands = [];
  for (const file of files.filter((name) => name.startsWith('src/commands/') && name.endsWith('.js') && !name.endsWith('.test.js'))) {
    const source = await readFile(path.join(projectRoot, file), 'utf8');
    const name = commandString(source, 'Name');
    const description = commandString(source, 'Description');
    if (name && description && !commands.some((command) => command.name === name)) {
      commands.push({ name, description });
    }
  }

  const date = options.date || new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error('Provide a valid UTC calendar date with --date YYYY-MM-DD.');
  }
  const version = options.version;
  const release = {
    version,
    title: options.title || `EasySupport ${version}`,
    date,
    summary: `This release includes ${subjects.length} categorized change${subjects.length === 1 ? '' : 's'} across ${files.length} changed path${files.length === 1 ? '' : 's'}, with ${commands.length} command update${commands.length === 1 ? '' : 's'}. Review these factual Git-based notes before publishing.`,
    changes,
    commands,
    files,
    source: { from: options.from, to: options.to },
  };

  if (version !== packageData.version) {
    throw new Error(`Release version ${version} does not match package.json version ${packageData.version}. Update package.json first.`);
  }

  const feed = JSON.parse(await readFile(feedPath, 'utf8'));
  if (!Array.isArray(feed.releases)) throw new Error(`Invalid release feed at ${feedPath}.`);
  feed.releases = [release, ...feed.releases.filter((entry) => entry.version !== version)];
  await writeFile(feedPath, `${JSON.stringify(feed, null, 2)}\n`);
  await writeFile(markdownPath, markdownFor(release));
  process.stdout.write(`Generated ${feedPath} and ${markdownPath} from ${range}.\n`);
}

main().catch((error) => {
  console.error(`[release-notes] ${error.message}`);
  process.exitCode = 1;
});
