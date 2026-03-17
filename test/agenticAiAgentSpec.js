import fs from 'node:fs/promises';

import { expect } from 'chai';

import { createStateEngine, validateConstraints, validateFeel, normalizeFeelValues } from '../dist/index.js';

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

describe('agentic AI agent - FEEL validation', function() {

  let template;

  before(async function() {
    template = JSON.parse(
      await fs.readFile('test/fixtures/templates/agenticai-aiagent-job-worker.json', 'utf8')
    );
  });

  it('should flag a feel:required field whose value is a plain string, not a FEEL expression', function() {

    // given - openaiCompatible headers is feel:required
    const inputValues = {
      'provider.type': 'openaiCompatible',
      'provider.openaiCompatible.headers': 'Content-Type: application/json' // plain string, not FEEL
    };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const violations = validateFeel(visibleProperties, inputValues);
    const violatedIds = violations.map((v) => v.id);

    // then
    expect(violatedIds).to.include('provider.openaiCompatible.headers');
    const v = violations.find((x) => x.id === 'provider.openaiCompatible.headers');
    expect(v.feel).to.equal('required');
    expect(v.message).to.include('=');
  });

  it('should not flag a feel:required field whose value is already a FEEL expression', function() {

    // given
    const inputValues = {
      'provider.type': 'openaiCompatible',
      'provider.openaiCompatible.headers': '= {"Content-Type": "application/json"}'
    };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const violations = validateFeel(visibleProperties, inputValues);
    const violatedIds = violations.map((v) => v.id);

    // then
    expect(violatedIds).to.not.include('provider.openaiCompatible.headers');
  });

  it('should not flag feel:optional fields regardless of value format', function() {

    // given - provider.anthropic.endpoint is feel:optional
    const inputValues = {
      'provider.type': 'anthropic',
      'provider.anthropic.endpoint': 'https://api.anthropic.com' // plain string, allowed for optional
    };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const violations = validateFeel(visibleProperties, inputValues);
    const violatedIds = violations.map((v) => v.id);

    // then - optional FEEL fields must not be flagged for plain values
    expect(violatedIds).to.not.include('provider.anthropic.endpoint');
  });

  it('should not flag feel:required fields that have no value yet', function() {

    // given - empty value is separately caught by notEmpty constraint, not FEEL validation
    const inputValues = { 'provider.type': 'openaiCompatible' };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const violations = validateFeel(visibleProperties, inputValues);
    const violatedIds = violations.map((v) => v.id);

    // then - empty / missing values are a constraint concern, not a FEEL format concern
    expect(violatedIds).to.not.include('provider.openaiCompatible.headers');
  });
});

describe('agentic AI agent - FEEL normalisation', function() {

  let template;

  before(async function() {
    template = JSON.parse(
      await fs.readFile('test/fixtures/templates/agenticai-aiagent-job-worker.json', 'utf8')
    );
  });

  it('should prefix Boolean feel:static values with "=" so they are valid FEEL literals', function() {

    // given - data.response.format.parseJson is Boolean / feel:static
    const inputValues = { 'data.response.format.parseJson': 'true' };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const normalized = normalizeFeelValues(visibleProperties, inputValues);

    // then
    expect(normalized['data.response.format.parseJson']).to.equal('= true');
  });

  it('should prefix Number feel:static values with "=" so they are valid FEEL literals', function() {

    // given - data.memory.contextWindowSize is Number / feel:static
    const inputValues = { 'data.memory.contextWindowSize': '50' };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const normalized = normalizeFeelValues(visibleProperties, inputValues);

    // then
    expect(normalized['data.memory.contextWindowSize']).to.equal('= 50');
  });

  it('should leave already-prefixed FEEL values unchanged', function() {

    // given
    const inputValues = { 'data.memory.contextWindowSize': '= contextSize' };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const normalized = normalizeFeelValues(visibleProperties, inputValues);

    // then - double-prefixing must not happen
    expect(normalized['data.memory.contextWindowSize']).to.equal('= contextSize');
  });

  it('should leave String / feel:optional values unchanged', function() {

    // given - provider.anthropic.endpoint is String / feel:optional
    const inputValues = {
      'provider.type': 'anthropic',
      'provider.anthropic.endpoint': 'https://api.anthropic.com'
    };
    const { visibleProperties } = createStateEngine(template, inputValues);

    // when
    const normalized = normalizeFeelValues(visibleProperties, inputValues);

    // then - String fields are never auto-wrapped
    expect(normalized['provider.anthropic.endpoint']).to.equal('https://api.anthropic.com');
  });
});
