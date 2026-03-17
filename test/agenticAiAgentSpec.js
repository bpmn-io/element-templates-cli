import fs from 'node:fs/promises';

import { expect } from 'chai';

import { createStateEngine, validateConstraints } from '../dist/index.js';

describe('agentic AI agent - Model Provider visibility', function() {

  let template;

  before(async function() {
    template = JSON.parse(
      await fs.readFile('test/fixtures/templates/agenticai-aiagent-job-worker.json', 'utf8')
    );
  });

  const providerIds = {
    anthropic: [ 'provider.anthropic.endpoint', 'provider.anthropic.authentication.apiKey', 'provider.anthropic.timeouts.timeout' ],
    bedrock: [ 'provider.bedrock.region', 'provider.bedrock.endpoint', 'provider.bedrock.authentication.type', 'provider.bedrock.timeouts.timeout' ],
    azureOpenAi: [ 'provider.azureOpenAi.endpoint', 'provider.azureOpenAi.authentication.type', 'provider.azureOpenAi.timeouts.timeout' ],
    'google-vertex-ai': [ 'provider.googleVertexAi.projectId', 'provider.googleVertexAi.region', 'provider.googleVertexAi.authentication.type' ],
    openai: [ 'provider.openai.authentication.apiKey', 'provider.openai.authentication.organizationId', 'provider.openai.timeouts.timeout' ],
    openaiCompatible: [ 'provider.openaiCompatible.endpoint', 'provider.openaiCompatible.authentication.apiKey' ]
  };

  for (const [ provider, expectedIds ] of Object.entries(providerIds)) {
    it(`should show only ${provider} fields when provider.type = "${provider}"`, function() {

      // when
      const { visibleProperties } = createStateEngine(template, { 'provider.type': provider });
      const ids = new Set(visibleProperties.map((p) => p.id).filter(Boolean));

      // then - expected fields are visible
      for (const id of expectedIds) {
        expect(ids, `expected "${id}" to be visible for provider "${provider}"`).to.include(id);
      }

      // then - fields of other providers are hidden
      for (const [ otherProvider, otherIds ] of Object.entries(providerIds)) {
        if (otherProvider === provider) {
          continue;
        }

        for (const id of otherIds) {
          expect(ids, `expected "${id}" to be hidden for provider "${provider}"`).to.not.include(id);
        }
      }
    });
  }
});

describe('agentic AI agent - constraint validation', function() {

  let template;

  before(async function() {
    template = JSON.parse(
      await fs.readFile('test/fixtures/templates/agenticai-aiagent-job-worker.json', 'utf8')
    );
  });

  it('should report violations for required anthropic fields when values are empty', function() {

    // given - provider selected but mandatory fields not filled in
    const { visibleProperties } = createStateEngine(template, { 'provider.type': 'anthropic' });

    // when
    const violations = validateConstraints(visibleProperties, { 'provider.type': 'anthropic' });
    const violatedIds = violations.map((v) => v.id);

    // then - the API key is required and must be flagged
    expect(violatedIds).to.include('provider.anthropic.authentication.apiKey');

    // then - no bedrock / azure / other provider fields bleed into violations
    expect(violatedIds.some((id) => id.startsWith('provider.bedrock'))).to.be.false;
    expect(violatedIds.some((id) => id.startsWith('provider.azureOpenAi'))).to.be.false;
  });

  it('should report no violations when all required anthropic fields are provided', function() {

    // given
    const inputValues = {
      'provider.type': 'anthropic',
      'provider.anthropic.authentication.apiKey': 'sk-ant-abc123'
    };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const violations = validateConstraints(visibleProperties, inputValues);
    const violatedIds = violations.map((v) => v.id);

    // then
    expect(violatedIds).to.not.include('provider.anthropic.authentication.apiKey');
  });

  it('should report violations only for the selected provider', function() {

    // given - openai selected with api key missing
    const inputValues = { 'provider.type': 'openai' };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const violations = validateConstraints(visibleProperties, inputValues);
    const violatedIds = violations.map((v) => v.id);

    // then - openai required field is flagged
    expect(violatedIds).to.include('provider.openai.authentication.apiKey');

    // then - anthropic and bedrock fields are not visible, so not validated
    expect(violatedIds.some((id) => id.startsWith('provider.anthropic'))).to.be.false;
    expect(violatedIds.some((id) => id.startsWith('provider.bedrock'))).to.be.false;
  });

  it('should surface violation details including label and constraint name', function() {

    // given
    const inputValues = { 'provider.type': 'anthropic' };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const violations = validateConstraints(visibleProperties, inputValues);
    const apiKeyViolation = violations.find((v) => v.id === 'provider.anthropic.authentication.apiKey');

    // then
    expect(apiKeyViolation).to.exist;
    expect(apiKeyViolation.constraint).to.equal('notEmpty');
    expect(apiKeyViolation.label).to.be.a('string').and.not.be.empty;
    expect(apiKeyViolation.message).to.be.a('string').and.not.be.empty;
  });
});
