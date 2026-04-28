#!/usr/bin/env node

import { parseArgs } from 'node:util';

import { readFile, writeFile } from 'node:fs/promises';

import {
  applyTemplate,
  queryFields,
  setFields,
  resolveTemplatePath,
  resolveTemplateId,
  listTemplates,
  downloadTemplate
} from '../dist/index.js';

const SUBCOMMANDS = [ 'apply', 'query', 'set', 'list', 'download' ];

const HELP = {
  root: `
Usage: element-templates-cli [subcommand] [options]

Subcommands:
  apply      Apply an element template to a BPMN element (default)
  query      Query visible fields of an element template as JSON
  set        Set field values on a BPMN element via an element template
  list       List available templates in local search paths
  download   Download and cache templates from a remote JSON file

Run \`element-templates-cli <subcommand> --help\` for subcommand details.
`.trim(),

  apply: `
Usage: element-templates-cli [apply] [options]

Apply an element template to a BPMN element.

Template source (exactly one required):
  --template-path, --tp <path>   Path to an element template JSON file
  --template-id,   --ti <id>     Template ID (e.g. io.camunda.connectors.HttpJson.v2);
                                 resolved via Desktop Modeler lookup paths and cached
  --template           <path>    Deprecated alias for --template-path

Options:
  --diagram   <path>   Path to the BPMN diagram file (required)
  --element   <id>     ID of the BPMN element to apply the template to (required)
  --output    <path>   Output path for the modified diagram; use "-" for stdout (default: "-")
  --help               Show this help message
`.trim(),

  query: `
Usage: element-templates-cli query [options]

Query the currently visible fields of an element template applied to a BPMN
element. Returns a JSON object grouped by section, where each field includes:
  type, value, choices (Dropdown), feel, constraints, description

Hidden fields (condition not met) are excluded. Ungrouped fields appear under "General".

Template source (exactly one required):
  --template-path, --tp <path>   Path to an element template JSON file
  --template-id,   --ti <id>     Template ID (e.g. io.camunda.connectors.HttpJson.v2)
  --template           <path>    Deprecated alias for --template-path

Options:
  --diagram   <path>   Path to the BPMN diagram file (required)
  --element   <id>     ID of the BPMN element to query (required)
  --help               Show this help message
`.trim(),

  set: `
Usage: element-templates-cli set [options]

Set field values on a BPMN element via an element template. Supports cascading
condition re-evaluation so newly-visible fields can be set in the same call.

Field keys in --values use the field label (e.g. "Label"). Use "Section.Label"
to disambiguate fields with the same label in different sections. Duplicate
labels within a section are suffixed with "(N)" (e.g. "Label (2)").

Constraints (notEmpty, pattern, minLength, maxLength) are enforced before applying.

Template source (exactly one required):
  --template-path, --tp <path>   Path to an element template JSON file
  --template-id,   --ti <id>     Template ID (e.g. io.camunda.connectors.HttpJson.v2)
  --template           <path>    Deprecated alias for --template-path

Options:
  --diagram   <path>     Path to the BPMN diagram file (required)
  --element   <id>       ID of the BPMN element to modify (required)
  --values    <json>     JSON object mapping field labels to values (required)
                         Example: --values '{"Task Name": "my-task", "Retries": "3"}'
  --output    <path>     Output path for the modified diagram; use "-" for stdout (default: "-")
  --help                 Show this help message
`.trim(),

  list: `
Usage: element-templates-cli list [options]

List templates available in local search paths (Desktop Modeler user data dir
and the CLI cache). When --id is given, all cached versions of that template
are shown instead.

Options:
  --id    <id>   Show all cached versions of a specific template ID
  --help         Show this help message
`.trim(),

  download: `
Usage: element-templates-cli download [options]

Download a template from the Camunda marketplace index and save it to the local
CLI cache so it is available to --template-id lookups.

Options:
  --id        <id>       Template ID to download (required)
  --version   <version>  Specific version to download (default: latest)
  --help                 Show this help message
`.trim()
};

const TEMPLATE_OPTIONS = {
  'template-path': { type: 'string' },
  'tp': { type: 'string' },
  'template-id': { type: 'string' },
  'ti': { type: 'string' },
  'template': { type: 'string' }
};

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

  if (args.includes('--help') || args.includes('-h')) {
    console.log(subcommand.detected ? HELP[subcommand.name] : HELP.root);
    return;
  }

  switch (subcommand.name) {
  case 'apply': return runApply(args);
  case 'query': return runQuery(args);
  case 'set': return runSet(args);
  case 'list': return runList(args);
  case 'download': return runDownload(args);
  default:
    console.error(
      `Unknown subcommand "${subcommand.name}". Use "apply", "query", "set", "list", or "download".`
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
    element: { type: 'string' },
    output: { type: 'string', default: '-' },
    ...TEMPLATE_OPTIONS
  };

  const { values: opts } = parseArgsOrHelp(args, options, 'apply');

  requireOptions(opts, [ 'diagram', 'element' ]);

  const diagram = await readFile(opts.diagram, 'utf8');
  const template = await resolveTemplate(opts);

  const xml = await applyTemplate(diagram, template, opts.element);

  await output(xml, opts.output);
}

async function runQuery(args) {

  const options = {
    diagram: { type: 'string' },
    element: { type: 'string' },
    ...TEMPLATE_OPTIONS
  };

  const { values: opts } = parseArgsOrHelp(args, options, 'query');

  requireOptions(opts, [ 'diagram', 'element' ]);

  const diagram = await readFile(opts.diagram, 'utf8');
  const template = await resolveTemplate(opts);

  const result = await queryFields(diagram, template, opts.element);

  console.log(JSON.stringify(result, null, 2));
}

async function runSet(args) {

  const options = {
    diagram: { type: 'string' },
    element: { type: 'string' },
    values: { type: 'string' },
    output: { type: 'string', default: '-' },
    ...TEMPLATE_OPTIONS
  };

  const { values: opts } = parseArgsOrHelp(args, options, 'set');

  requireOptions(opts, [ 'diagram', 'element', 'values' ]);

  const diagram = await readFile(opts.diagram, 'utf8');
  const template = await resolveTemplate(opts);
  const fieldValues = parseValues(opts.values);

  const xml = await setFields(diagram, template, opts.element, fieldValues);

  await output(xml, opts.output);
}

async function runList(args) {

  const options = {
    id: { type: 'string' }
  };

  const { values: opts } = parseArgsOrHelp(args, options, 'list');

  const entries = await listTemplates();

  if (opts.id) {
    const versions = entries.filter(e => e.id === opts.id);
    if (versions.length === 0) {
      console.error(`No templates found with id "${opts.id}".`);
      process.exit(1);
    }
    for (const e of versions) {
      const ver = e.version !== undefined ? `v${e.version}` : '(no version)';
      console.log(`${e.id}  ${ver}  [${e.source}]`);
    }
  } else {

    // Deduplicate by id, show distinct ids
    const seen = new Set();
    for (const e of entries) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      console.log(`${e.id}  ${e.name !== e.id ? `(${e.name})` : ''}`);
    }
  }
}

async function runDownload(args) {

  const options = {
    id: { type: 'string' },
    version: { type: 'string' }
  };

  const { values: opts } = parseArgsOrHelp(args, options, 'download');

  if (!opts.id) {
    console.error('Missing required option "--id". Run with --help for usage.');
    process.exit(1);
  }

  const version = opts.version !== undefined ? Number(opts.version) : undefined;

  if (opts.version !== undefined && isNaN(version)) {
    console.error('--version must be a number.');
    process.exit(1);
  }

  const { id, version: ver, file } = await downloadTemplate(opts.id, { version });

  const verLabel = ver !== undefined ? `v${ver}` : '(no version)';
  console.log(`Saved ${id} ${verLabel} → ${file}`);
}

async function resolveTemplate(opts) {
  const templatePath = opts['template-path'] ?? opts.tp ?? opts.template;
  const templateId = opts['template-id'] ?? opts.ti;

  if (templatePath && templateId) {
    throw new Error('Use only one of --template-path / --template-id.');
  }

  if (!templatePath && !templateId) {
    throw new Error(
      'Missing template source. Use --template-path <path> or --template-id <id>. ' +
      'Run with --help for usage.'
    );
  }

  if (templatePath) {
    return resolveTemplatePath(templatePath);
  }

  return resolveTemplateId(templateId, { diagramPath: opts.diagram });
}

function requireOptions(opts, required) {
  for (const name of required) {
    if (opts[name] === undefined) {
      console.error(`Missing required option "--${name}". Run with --help for usage.`);
      process.exit(1);
    }
  }
}

function parseArgsOrHelp(args, options, subcommand) {
  try {
    return parseArgs({ args, options });
  } catch (err) {
    console.error(`${err.message}\n\n${HELP[subcommand]}`);
    process.exit(1);
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
