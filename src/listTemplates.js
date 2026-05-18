import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { getCliCacheDir, getModelerUserDataDir } from './resolveTemplate.js';

/**
 * @typedef {{ id: string, name: string, version: number|undefined, source: string }} TemplateEntry
 */

/**
 * List all template entries found across all standard search dirs.
 *
 * @param {object} [options]
 * @param {string} [options.cacheDir]
 * @param {string} [options.modelerDir]
 * @param {string} [options.diagramPath]   When provided, also walks up .camunda dirs
 * @returns {Promise<TemplateEntry[]>}
 */
export async function listTemplates(options = {}) {
  const {
    cacheDir = getCliCacheDir(),
    modelerDir = getModelerUserDataDir(),
    diagramPath
  } = options;

  const searchDirs = [];

  if (diagramPath) {
    searchDirs.push(...walkUpCamundaDirs(path.dirname(path.resolve(diagramPath))));
  }

  if (modelerDir) {
    searchDirs.push({
      dir: path.join(modelerDir, 'resources', 'element-templates'),
      label: 'modeler'
    });
  }

  searchDirs.push({
    dir: path.join(cacheDir, 'templates'),
    label: 'cache'
  });

  const seen = new Map(); // id -> TemplateEntry[]
  const allEntries = [];

  for (const { dir, label } of searchDirs) {
    const entries = await scanDir(dir, label);
    for (const entry of entries) {
      allEntries.push(entry);
      if (!seen.has(entry.id)) {
        seen.set(entry.id, []);
      }
      seen.get(entry.id).push(entry);
    }
  }

  return allEntries;
}

function walkUpCamundaDirs(startDir) {
  const dirs = [];
  let current = startDir;
  let parent = path.dirname(current);

  dirs.push({
    dir: path.join(current, '.camunda', 'element-templates'),
    label: path.join(current, '.camunda', 'element-templates')
  });

  while (parent !== current) {
    current = parent;
    parent = path.dirname(current);
    dirs.push({
      dir: path.join(current, '.camunda', 'element-templates'),
      label: path.join(current, '.camunda', 'element-templates')
    });
  }

  return dirs;
}

async function scanDir(dir, label) {
  if (!existsSync(dir)) {
    return [];
  }

  let entries;
  try {
    entries = await readdir(dir, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }

  const results = [];

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
      if (!template?.id) continue;
      results.push({
        id: template.id,
        name: template.name ?? template.id,
        version: template.version,
        source: label
      });
    }
  }

  return results;
}
