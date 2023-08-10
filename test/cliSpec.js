import { promisify } from 'node:util';
import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect } from 'chai';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_PATH = path.resolve(__dirname, '../bin/cli.js');
const execFile = promisify(childProcess.execFile);

describe('cli', function() {

  it('should apply a template', async function() {

    // given
    const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
    const template = 'test/fixtures/templates/rest-conditional.json';
    const element = 'ServiceTask';
    const expected = await fs.readFile('test/fixtures/diagrams/rest-conditional_expected.bpmn', 'utf8');

    // when
    const { stdout } = await exec({
      diagram,
      template,
      element
    });

    // then
    expect(stdout.trim()).to.eql(expected.trim());
  });

});

function exec(argsMap) {
  const args = prepareArgs(argsMap);

  return execFile(CLI_PATH, args, {
    cwd: path.resolve(__dirname, '..')
  });
}

function prepareArgs({
  diagram,
  template,
  element,
  output
}) {
  const args = [];

  if (diagram) {
    args.push('--diagram', diagram);
  }

  if (template) {
    args.push('--template', template);
  }

  if (element) {
    args.push('--element', element);
  }

  if (output) {
    args.push('--output', output);
  }

  return args;
}
