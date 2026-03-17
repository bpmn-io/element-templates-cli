import fs from 'node:fs/promises';

import { expect } from 'chai';

import { createStateEngine } from '../dist/index.js';

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
