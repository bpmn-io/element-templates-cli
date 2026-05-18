import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getCliCacheDir } from './resolveTemplate.js';

const MARKETPLACE_URL = 'https://marketplace.cloud.camunda.io/api/v1/ootb-connectors';

/**
 * Download a specific template version from the marketplace index and save it
 * to the local CLI cache.
 *
 * The marketplace index format is: { [id]: [{ version, ref, engine }] }
 *
 * @param {string} id         Template ID to download
 * @param {object} [options]
 * @param {number} [options.version]       Specific version to download; defaults to latest
 * @param {string} [options.cacheDir]
 * @param {string} [options.marketplaceUrl]
 * @param {Function} [options.fetchFn]
 * @returns {Promise<{ id: string, version: number|undefined, file: string }>}
 */
export async function downloadTemplate(id, options = {}) {
  const {
    version,
    cacheDir = getCliCacheDir(),
    marketplaceUrl = MARKETPLACE_URL,
    fetchFn = fetch
  } = options;

  const indexResponse = await fetchFn(marketplaceUrl);
  if (!indexResponse.ok) {
    throw new Error(
      `Failed to fetch marketplace index (HTTP ${indexResponse.status})`
    );
  }

  const index = await indexResponse.json();
  const entries = index[id];

  if (!entries || entries.length === 0) {
    throw new Error(
      `Template "${id}" not found in marketplace. Check the ID and try again.`
    );
  }

  let entry;
  if (version !== undefined) {
    entry = entries.find(e => e.version === version);
    if (!entry) {
      const available = entries.map(e => e.version).sort((a, b) => b - a).join(', ');
      throw new Error(
        `Version ${version} of "${id}" not found in marketplace. Available: ${available}`
      );
    }
  } else {
    entry = entries.reduce((a, b) => (a.version >= b.version ? a : b));
  }

  const templateResponse = await fetchFn(entry.ref);
  if (!templateResponse.ok) {
    throw new Error(
      `Failed to fetch template "${id}" v${entry.version} from ${entry.ref} (HTTP ${templateResponse.status})`
    );
  }

  const templateText = await templateResponse.text();

  const templatesDir = path.join(cacheDir, 'templates');
  await mkdir(templatesDir, { recursive: true });

  const filename = sanitizeFilename(id) +
    (entry.version !== undefined ? `_v${entry.version}` : '') +
    '.json';
  const filePath = path.join(templatesDir, filename);
  await writeFile(filePath, templateText);

  return { id, version: entry.version, file: filePath };
}

function sanitizeFilename(id) {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}
