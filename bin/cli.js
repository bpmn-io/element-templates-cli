#!/usr/bin/env node

import { parseArgs } from 'node:util';

import { readFile, writeFile } from 'node:fs/promises';

import {
  applyTemplate
} from '../dist/index.js';

run();

async function run() {

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

  const { values } = parseArgs({ options });

  for (const option in options) {
    if (!values[option]) {
      throw new Error(`Missing option "${option}"`);
    }
  }

  const diagram = await readFile(values.diagram, 'utf8');
  const template = await readFile(values.template, 'utf8');

  const xml = await applyTemplate(diagram, template, values.element);

  if (values.output === '-') {
    console.log(xml);
    return;
  }

  await writeFile(values.output, xml);
}
