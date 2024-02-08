#!/usr/bin/env node

import { parseArgs } from 'node:util';

import { readFile, writeFile } from 'node:fs/promises';

import {
  applyTemplate,
  validate as validateTemplate
} from '../dist/index.js';

run();

function run() {
  const command = process.argv[2];

  switch (command) {
  case 'apply':
    return apply();
  case 'validate':
    return validate();
  }

  throw new Error(`unknown command: ${command}`);


}

async function apply() {
  const options = {
    diagram: {
      type: 'string'
    },
    template: {
      type: 'string'
    },
    element: {
      type: 'string'
    },
    output: {
      type: 'string',
      default: '-'
    }
  };

  const { values } = parse({ options });

  const diagram = await readFile(values.diagram, 'utf8');
  const template = await readFile(values.template, 'utf8');

  const xml = await applyTemplate(diagram, template, values.element);

  if (values.output === '-') {
    console.log(xml);
    return;
  }

  await writeFile(values.output, xml);
}

async function validate() {
  const {
    positionals: templates
  } = parse({
    allowPositionals: true,
  });

  for (const templatePath of templates) {
    const template = await readFile(templatePath, 'utf8');

    const result = validateTemplate(template);
    console.log(result);
  }
}

function parse(config) {
  const result = parseArgs({ ...config, allowPositionals: true });

  for (const option in config.options || []) {
    if (!result.values[option]) {
      throw new Error(`Missing option "${option}"`);
    }
  }

  return { ...result, positionals: result.positionals.slice(1) || [] };
}
