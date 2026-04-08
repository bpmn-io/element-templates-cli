#!/usr/bin/env node

import { parseArgs } from 'node:util';

import { readFile, writeFile } from 'node:fs/promises';

import {
  applyTemplate,
  queryFields,
  setFields
} from '../dist/index.js';

const SUBCOMMANDS = [ 'apply', 'query', 'set' ];

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});

async function run() {

  // Detect subcommand: first non-flag argument
  const subcommand = detectSubcommand();
  const args = subcommand.detected
    ? process.argv.slice(3)
    : process.argv.slice(2);

  switch (subcommand.name) {
    case 'apply': return runApply(args);
    case 'query': return runQuery(args);
    case 'set': return runSet(args);
    default:
      console.error(
        `Unknown subcommand "${subcommand.name}". Use "apply", "query", or "set".`
      );
      process.exit(1);
  }
}

function detectSubcommand() {
  const arg = process.argv[2];

  // No arguments or starts with -- => default to 'apply' (backward compat)
  if (!arg || arg.startsWith('--')) {
    return { name: 'apply', detected: false };
  }

  // Only consume as subcommand if it's a known command,
  // otherwise fall back to 'apply' (backward compat)
  if (SUBCOMMANDS.includes(arg)) {
    return { name: arg, detected: true };
  }

  return { name: 'apply', detected: false };
}

async function runApply(args) {

  const options = {
    diagram: { type: 'string' },
    template: { type: 'string' },
    element: { type: 'string' },
    output: { type: 'string', default: '-' }
  };

  const { values: opts } = parseArgs({ args, options });

  requireOptions(opts, [ 'diagram', 'template', 'element' ]);

  const diagram = await readFile(opts.diagram, 'utf8');
  const template = await readFile(opts.template, 'utf8');

  const xml = await applyTemplate(diagram, template, opts.element);

  await output(xml, opts.output);
}

async function runQuery(args) {

  const options = {
    diagram: { type: 'string' },
    template: { type: 'string' },
    element: { type: 'string' }
  };

  const { values: opts } = parseArgs({ args, options });

  requireOptions(opts, [ 'diagram', 'template', 'element' ]);

  const diagram = await readFile(opts.diagram, 'utf8');
  const template = await readFile(opts.template, 'utf8');

  const result = await queryFields(diagram, template, opts.element);

  console.log(JSON.stringify(result, null, 2));
}

async function runSet(args) {

  const options = {
    diagram: { type: 'string' },
    template: { type: 'string' },
    element: { type: 'string' },
    values: { type: 'string' },
    output: { type: 'string', default: '-' }
  };

  const { values: opts } = parseArgs({ args, options });

  requireOptions(opts, [ 'diagram', 'template', 'element', 'values' ]);

  const diagram = await readFile(opts.diagram, 'utf8');
  const template = await readFile(opts.template, 'utf8');
  const fieldValues = parseValues(opts.values);

  const xml = await setFields(diagram, template, opts.element, fieldValues);

  await output(xml, opts.output);
}

function requireOptions(opts, required) {
  for (const name of required) {
    if (opts[name] === undefined) {
      console.error(`Missing required option "--${name}"`);
      process.exit(1);
    }
  }
}

function parseValues(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in --values: ${ e.message }`);
  }
}

async function output(content, dest) {
  if (!dest || dest === '-') {
    console.log(content);
  } else {
    await writeFile(dest, content);
  }
}
