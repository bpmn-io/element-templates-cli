import fs from 'node:fs/promises';

import { expect } from 'chai';

import { applyTemplate, createStateEngine, isConditionVisible } from '../dist/index.js';

describe('state engine', function() {

  it('should resolve visibility based on provided values', async function() {

    // given
    const template = JSON.parse(await fs.readFile('test/fixtures/templates/task-header-with-condition.json', 'utf8'));

    // when
    const { visibleProperties } = createStateEngine(template, {
      authenticationType: ''
    });

    // then
    const ids = visibleProperties.map((property) => property.id).filter(Boolean);
    expect(ids).to.not.include('resultExpression');
  });

  it('should throw on unsupported condition format', function() {

    // expect
    expect(() => isConditionVisible({
      property: 'foo'
    }, {
      foo: 'bar'
    })).to.throw('Unsupported condition');
  });

  it('should apply conditionally visible defaults after value updates', async function() {

    // given
    const diagram = await fs.readFile('test/fixtures/diagrams/task-header-with-condition.bpmn', 'utf8');
    const template = await fs.readFile('test/fixtures/templates/task-header-with-condition.json', 'utf8');

    // when
    const xml = await applyTemplate(diagram, template, 'ServiceTask', {
      authenticationType: ''
    });

    // then
    expect(xml).to.not.include('key="resultExpression"');
  });

});
