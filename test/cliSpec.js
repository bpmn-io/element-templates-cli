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

  describe('apply template', function() {

    testApply('rest-conditional');


    testApply('easy-post-connector');


    testApply('task-header-with-condition');
  });


  describe('validate template', function() {

    testValidate('rest-conditional');


    testValidate('easy-post-connector');


    testValidate('task-header-with-condition');
  });
});



// helpers //////////////////////
function testApply(testName, element = 'ServiceTask', fn = it) {
  fn(`should work for: ${testName}`, async function() {

    // given
    const diagram = `test/fixtures/diagrams/${testName}.bpmn`;
    const template = `test/fixtures/templates/${testName}.json`;
    const expected = await fs.readFile(`test/fixtures/diagrams/${testName}_expected.bpmn`, 'utf8');

    // when
    const { stdout } = await exec(prepareApplyArgs({
      diagram,
      template,
      element
    }));

    // then
    expect(withoutDiagram(stdout.trim())).to.eql(withoutDiagram(expected.trim()));
  });
}

function testValidate(testName, fn = it) {
  const template = `test/fixtures/templates/${testName}.json`;

  fn(`should validate for: ${testName}`, async function() {
    return exec([ 'validate', template ]);
  });
}

function prepareApplyArgs({
  diagram,
  template,
  element,
  output
}) {
  const args = [ 'apply' ];

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

/**
 * @param {string} xml
 */
function withoutDiagram(xml) {
  const START_CLAUSE = '<bpmndi:BPMNDiagram';
  const END_CLAUSE = '</bpmndi:BPMNDiagram>';

  const startPosition = xml.search(START_CLAUSE);
  const endPosition = xml.search(END_CLAUSE);

  return xml.slice(0, startPosition) + xml.slice(endPosition + END_CLAUSE.length);
}

function exec(args) {
  return execFile(CLI_PATH, args, {
    cwd: path.resolve(__dirname, '..')
  });
}
