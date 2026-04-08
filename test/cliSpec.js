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

  test.only = function(testName, templateName, element) {
    return test(testName, templateName, element, true);
  };

  describe('apply template', function() {

    test('rest-conditional');


    test('easy-post-connector');


    test('task-header-with-condition');


    test('add-item');


    test('ad-hoc-sub-process', 'add-item');


    test('ad-hoc', 'ad-hoc', 'AdHocSubProcess');
  });


  describe('apply template (with subcommand)', function() {

    it('should work with explicit apply subcommand', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';
      const expected = await fs.readFile(
        'test/fixtures/diagrams/rest-conditional_expected.bpmn', 'utf8'
      );

      // when
      const { stdout } = await exec({
        subcommand: 'apply',
        diagram,
        template,
        element: 'ServiceTask'
      });

      // then
      expect(withoutDiagram(stdout.trim())).to.eql(withoutDiagram(expected.trim()));
    });
  });


  describe('query fields', function() {

    it('should return visible fields with default values (no groups)', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when
      const { stdout } = await exec({
        subcommand: 'query',
        diagram,
        template,
        element: 'ServiceTask'
      });

      const result = JSON.parse(stdout);

      // then - should have General section
      expect(result).to.have.property('General');

      const general = result['General'];

      // Visible: REST Endpoint URL, REST Method, Authentication Type
      expect(general).to.have.property('REST Endpoint URL');
      expect(general).to.have.property('REST Method');
      expect(general).to.have.property('Authentication Type');

      // Hidden: Request Body (method=get), Username, Password, Bearer Token
      expect(general).to.not.have.property('Request Body');
      expect(general).to.not.have.property('Username');
      expect(general).to.not.have.property('Password');
      expect(general).to.not.have.property('Bearer Token');
    });


    it('should include type and choices for Dropdown fields', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when
      const { stdout } = await exec({
        subcommand: 'query',
        diagram,
        template,
        element: 'ServiceTask'
      });

      const result = JSON.parse(stdout);
      const method = result['General']['REST Method'];

      // then
      expect(method.type).to.eql('Dropdown');
      expect(method.value).to.eql('get');
      expect(method.choices).to.deep.eql([
        { name: 'GET', value: 'get' },
        { name: 'POST', value: 'post' },
        { name: 'PATCH', value: 'patch' },
        { name: 'DELETE', value: 'delete' }
      ]);
    });


    it('should include constraints', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when
      const { stdout } = await exec({
        subcommand: 'query',
        diagram,
        template,
        element: 'ServiceTask'
      });

      const result = JSON.parse(stdout);
      const url = result['General']['REST Endpoint URL'];

      // then
      expect(url.type).to.eql('String');
      expect(url.constraints).to.deep.eql({
        notEmpty: true,
        pattern: {
          value: '^https?://.*',
          message: 'Must be http(s) URL.'
        }
      });
    });


    it('should organize fields by groups', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/easy-post-connector.bpmn';
      const template = 'test/fixtures/templates/easy-post-connector.json';

      // when
      const { stdout } = await exec({
        subcommand: 'query',
        diagram,
        template,
        element: 'ServiceTask'
      });

      const result = JSON.parse(stdout);
      const sections = Object.keys(result);

      // then - should have known groups
      expect(sections).to.include('Operation');
      expect(sections).to.include('Authentication');
      expect(sections).to.include('Error handling');

      // Operation type dropdown should be in Operation group
      expect(result['Operation']).to.have.property('Operation type');
      expect(result['Operation']['Operation type'].type).to.eql('Dropdown');
    });


    it('should include feel mode when set', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/easy-post-connector.bpmn';
      const template = 'test/fixtures/templates/easy-post-connector.json';

      // when
      const { stdout } = await exec({
        subcommand: 'query',
        diagram,
        template,
        element: 'ServiceTask'
      });

      const result = JSON.parse(stdout);

      // then - API key has feel: optional
      expect(result['Authentication']['API key'].feel).to.eql('optional');
    });


    it('should not include feel when not set', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when
      const { stdout } = await exec({
        subcommand: 'query',
        diagram,
        template,
        element: 'ServiceTask'
      });

      const result = JSON.parse(stdout);

      // then - REST Method has no feel property
      expect(result['General']['REST Method']).to.not.have.property('feel');
    });


    it('should include description when present', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when
      const { stdout } = await exec({
        subcommand: 'query',
        diagram,
        template,
        element: 'ServiceTask'
      });

      const result = JSON.parse(stdout);

      // then
      expect(result['General']['REST Endpoint URL'].description)
        .to.eql('Specify the url of the REST API to talk to.');
      expect(result['General']['REST Method'].description)
        .to.eql('Specify the HTTP method to use.');
    });
  });


  describe('set fields', function() {

    it('should set a simple field value', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when
      const { stdout } = await exec({
        subcommand: 'set',
        diagram,
        template,
        element: 'ServiceTask',
        values: JSON.stringify({ 'REST Endpoint URL': 'https://example.com' })
      });

      // then - URL should appear in the output
      expect(stdout).to.include('value="https://example.com"');
    });


    it('should set dropdown value and reveal conditional fields', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when - set method to post, which should reveal Request Body
      const { stdout: setOutput } = await exec({
        subcommand: 'set',
        diagram,
        template,
        element: 'ServiceTask',
        values: JSON.stringify({ 'REST Method': 'post' })
      });

      // then - method should be post in task headers
      expect(setOutput).to.include('value="post"');
    });


    it('should handle cascading conditions in a single call', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when - set method + auth + credentials in one call
      const { stdout } = await exec({
        subcommand: 'set',
        diagram,
        template,
        element: 'ServiceTask',
        values: JSON.stringify({
          'REST Method': 'post',
          'Authentication Type': 'basic',
          'Username': 'admin',
          'Password': 'secret'
        })
      });

      // then - all values should be in the output
      expect(stdout).to.include('source="admin" target="authentication.username"');
      expect(stdout).to.include('source="secret" target="authentication.password"');
      expect(stdout).to.include('source="basic" target="authentication.type"');
      expect(stdout).to.include('value="post"');
    });


    it('should reject invalid values (pattern constraint)', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when/then
      try {
        await exec({
          subcommand: 'set',
          diagram,
          template,
          element: 'ServiceTask',
          values: JSON.stringify({ 'REST Endpoint URL': 'not-a-url' })
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.stderr).to.include('Validation failed');
        expect(err.stderr).to.include('Must be http(s) URL');
      }
    });


    it('should error on unknown field labels', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when/then
      try {
        await exec({
          subcommand: 'set',
          diagram,
          template,
          element: 'ServiceTask',
          values: JSON.stringify({ 'Nonexistent Field': 'value' })
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.stderr).to.include('Could not resolve fields');
        expect(err.stderr).to.include('Nonexistent Field');
      }
    });


    it('should error on fields hidden by conditions', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when/then - Username requires method=post + auth=basic, but we don't set those
      try {
        await exec({
          subcommand: 'set',
          diagram,
          template,
          element: 'ServiceTask',
          values: JSON.stringify({ 'Username': 'admin' })
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.stderr).to.include('Could not resolve fields');
        expect(err.stderr).to.include('Username');
      }
    });


    it('should support Section.Label format for disambiguation', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/easy-post-connector.bpmn';
      const template = 'test/fixtures/templates/easy-post-connector.json';

      // when - use "Error handling.Connection timeout" qualified format
      const { stdout } = await exec({
        subcommand: 'set',
        diagram,
        template,
        element: 'ServiceTask',
        values: JSON.stringify({ 'Error handling.Connection timeout': '30' })
      });

      // then
      expect(stdout).to.include('30');
    });


    it('should error on invalid JSON in --values', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when/then
      try {
        await exec({
          subcommand: 'set',
          diagram,
          template,
          element: 'ServiceTask',
          values: 'not-json'
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.stderr).to.include('Invalid JSON');
      }
    });


    it('should error on non-existent element ID', async function() {

      // given
      const diagram = 'test/fixtures/diagrams/rest-conditional.bpmn';
      const template = 'test/fixtures/templates/rest-conditional.json';

      // when/then
      try {
        await exec({
          subcommand: 'query',
          diagram,
          template,
          element: 'NonexistentElement'
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.stderr).to.include('not found in diagram');
      }
    });
  });
});

function test(testName, templateName = testName, element = 'ServiceTask', only = false) {
  const fn = only ? it.only : it;

  fn(`should work for: ${testName}`, async function() {

    // given
    const diagram = `test/fixtures/diagrams/${testName}.bpmn`;
    const template = `test/fixtures/templates/${templateName}.json`;
    const expected = await fs.readFile(`test/fixtures/diagrams/${testName}_expected.bpmn`, 'utf8');

    // when
    const { stdout } = await exec({
      diagram,
      template,
      element
    });

    // then
    expect(withoutDiagram(stdout.trim())).to.eql(withoutDiagram(expected.trim()));
  });
}

function exec({ subcommand, diagram, template, element, output, values } = {}) {
  const args = [];

  if (subcommand) {
    args.push(subcommand);
  }

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

  if (values) {
    args.push('--values', values);
  }

  return execFile(CLI_PATH, args, {
    cwd: path.resolve(__dirname, '..')
  });
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
