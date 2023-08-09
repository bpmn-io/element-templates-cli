#!/usr/bin/env node

const { parseArgs } = require('node:util');

const { readFile, writeFile } = require('node:fs/promises');

const {
  applyTemplate
} = require('../index.js');

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
      type: 'string'
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

  await writeFile(values.output, xml);
}
