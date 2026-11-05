import { readFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const releaseDataPath = path.join(projectRoot, 'src', 'data', 'releases.json');
const localReleaseFeed = JSON.parse(readFileSync(releaseDataPath, 'utf8'));
const githubReleasesUrl = 'https://api.github.com/repos/Marcel1kub1/EasySupport/releases?per_page=10';
const releaseCacheDuration = 5 * 60 * 1000;
let releaseCache = Array.isArray(localReleaseFeed.releases) ? localReleaseFeed.releases : [];
let releaseCacheUpdatedAt = 0;
let releaseRefreshPromise;

function isReleaseEntry(release) {
  return (
    release &&
    typeof release.version === 'string' &&
    typeof release.title === 'string' &&
    typeof release.date === 'string' &&
    typeof release.summary === 'string' &&
    release.changes &&
    typeof release.changes === 'object' &&
    !Array.isArray(release.changes) &&
    Object.values(release.changes).every(Array.isArray) &&
    Array.isArray(release.commands) &&
    release.commands.every((command) => typeof command.name === 'string' && typeof command.description === 'string') &&
    Array.isArray(release.files) &&
    release.files.every((file) => typeof file === 'string')
  );
}

function releaseChanges(body) {
  const changes = {};
  let category = 'Release notes';

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      category = heading[1].replaceAll('**', '').replaceAll('`', '');
      continue;
    }

    const entry = line
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replaceAll('**', '')
      .replaceAll('`', '');
    changes[category] ??= [];
    changes[category].push(entry);
  }

  return changes;
}

function mapGitHubRelease(release) {
  if (
    !release ||
    typeof release.tag_name !== 'string' ||
    typeof release.html_url !== 'string' ||
    typeof release.published_at !== 'string' ||
    release.draft ||
    release.prerelease
  ) {
    return null;
  }

  const body = typeof release.body === 'string' ? release.body : '';
  const bodyLines = body.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const summaryLine = bodyLines.find((line) => !/^#{1,6}\s|^[-*+]\s|^\d+\.\s/.test(line));
  const summary = (summaryLine ?? bodyLines[0] ?? release.name ?? release.tag_name)
    .replace(/^[-*+]\s+/, '')
    .replaceAll('**', '')
    .replaceAll('`', '');

  return {
    version: release.tag_name,
    title: release.name?.trim() || `EasySupport ${release.tag_name}`,
    date: release.published_at.slice(0, 10),
    summary: summary.length > 240 ? `${summary.slice(0, 237)}...` : summary,
    changes: releaseChanges(body),
    commands: [],
    files: [],
    url: release.html_url,
  };
}

export async function getReleaseFeed() {
  if (Date.now() - releaseCacheUpdatedAt < releaseCacheDuration) return releaseCache;
  if (releaseRefreshPromise) return releaseRefreshPromise;

  releaseRefreshPromise = (async () => {
    try {
      const response = await fetch(githubReleasesUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'EasySupport-Guild-Dashboard',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`GitHub Releases API returned HTTP ${response.status}`);

      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('GitHub Releases API returned an invalid release list');

      releaseCache = payload.map(mapGitHubRelease).filter(Boolean);
      releaseCacheUpdatedAt = Date.now();
    } catch (error) {
      console.error('[releases] Could not refresh GitHub releases; using the last available feed:', error);
      releaseCacheUpdatedAt = Date.now();
    } finally {
      releaseRefreshPromise = undefined;
    }

    return releaseCache;
  })();

  return releaseRefreshPromise;
}
