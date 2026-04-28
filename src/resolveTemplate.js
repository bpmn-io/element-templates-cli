import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MARKETPLACE_URL = 'https://marketplace.cloud.camunda.io/api/v1/ootb-connectors';

export async function resolveTemplatePath(templatePath) {
  return readFile(templatePath, 'utf8');
}

export async function resolveTemplateId(id, options = {}) {
  const {
    diagramPath,
    cacheDir = getCliCacheDir(),
    modelerDir = getModelerUserDataDir(),
    marketplaceUrl = MARKETPLACE_URL,
    fetchFn = fetch
  } = options;

  const searchDirs = [];

  if (diagramPath) {
    searchDirs.push(...walkUpCamundaDirs(path.dirname(path.resolve(diagramPath))));
  }

  if (modelerDir) {
    searchDirs.push(path.join(modelerDir, 'resources', 'element-templates'));
  }

  searchDirs.push(path.join(cacheDir, 'templates'));

  for (const dir of searchDirs) {
    const found = await findTemplateInDir(dir, id);
    if (found) {
      return found;
    }
  }

  return fetchAndCache(id, cacheDir, marketplaceUrl, fetchFn);
}

function walkUpCamundaDirs(startDir) {
  const dirs = [];
  let current = startDir;
  let parent = path.dirname(current);

  dirs.push(path.join(current, '.camunda', 'element-templates'));
  while (parent !== current) {
    current = parent;
    parent = path.dirname(current);
    dirs.push(path.join(current, '.camunda', 'element-templates'));
  }

  return dirs;
}

async function findTemplateInDir(dir, id) {
  if (!existsSync(dir)) {
    return null;
  }

  let entries;
  try {
    entries = await readdir(dir, { recursive: true, withFileTypes: true });
  } catch {
    return null;
  }

  let best = null;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    const filePath = path.join(entry.parentPath || dir, entry.name);

    let parsed;
    try {
      parsed = JSON.parse(await readFile(filePath, 'utf8'));
    } catch {
      continue;
    }

    const templates = Array.isArray(parsed) ? parsed : [ parsed ];

    for (const template of templates) {
      if (template?.id === id) {
        if (!best || (template.version ?? 0) > (best.template.version ?? 0)) {
          best = { template, filePath };
        }
      }
    }
  }

  return best ? JSON.stringify(best.template) : null;
}

async function fetchAndCache(id, cacheDir, marketplaceUrl, fetchFn) {
  const indexResponse = await fetchFn(marketplaceUrl);
  if (!indexResponse.ok) {
    throw new Error(
      `Failed to fetch marketplace index (HTTP ${indexResponse.status}). ` +
      `Template "${id}" not found in local paths.`
    );
  }

  const index = await indexResponse.json();
  const versions = index[id];

  if (!versions || versions.length === 0) {
    throw new Error(
      `Template "${id}" not found in local paths or marketplace. ` +
      'Check the ID and try again.'
    );
  }

  const latest = versions.reduce((a, b) => (a.version >= b.version ? a : b));

  const templateResponse = await fetchFn(latest.ref);
  if (!templateResponse.ok) {
    throw new Error(
      `Failed to fetch template "${id}" from ${latest.ref} (HTTP ${templateResponse.status})`
    );
  }

  const templateText = await templateResponse.text();

  const templatesDir = path.join(cacheDir, 'templates');
  await mkdir(templatesDir, { recursive: true });

  const filename = sanitizeFilename(id) + '.json';
  await writeFile(path.join(templatesDir, filename), templateText);

  return templateText;
}

function sanitizeFilename(id) {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getCliCacheDir() {
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) {
    return path.join(xdg, 'element-templates-cli');
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'element-templates-cli', 'Cache');
  }
  return path.join(os.homedir(), '.cache', 'element-templates-cli');
}

export function getModelerUserDataDir() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'camunda-modeler');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'camunda-modeler');
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    return path.join(xdg, 'camunda-modeler');
  }
  return path.join(os.homedir(), '.config', 'camunda-modeler');
}
