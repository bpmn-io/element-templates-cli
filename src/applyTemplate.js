import Modeler from 'bpmn-js-headless/lib/Modeler';
import ZeebeModdleExtension from 'zeebe-bpmn-moddle/resources/zeebe.json';
import { CloudElementTemplatesCoreModule } from 'bpmn-js-element-templates/core';
import { createStateEngine } from './stateEngine.js';

export async function applyTemplate(diagram, template, element, values = {}) {
  const parsedTemplate = JSON.parse(template);
  const effectiveTemplate = withResolvedState(parsedTemplate, values);

  const modeler = await importDiagram(diagram);
  const el = getElement(modeler, element);
  applyTemplateToElement(modeler, el, effectiveTemplate);

  const xml = await exportDiagram(modeler);

  return xml;
}

async function importDiagram(diagram) {
  const modeler = new Modeler({
    additionalModules: [
      CloudElementTemplatesCoreModule
    ],
    moddleExtensions: {
      zeebe: ZeebeModdleExtension
    }
  });

  await modeler.importXML(diagram);

  return modeler;
}

async function exportDiagram(modeler) {
  const result = await modeler.saveXML({
    format: true
  });

  return result.xml;
}

function getElement(modeler, element) {
  const elementRegistry = modeler.get('elementRegistry');

  return elementRegistry.get(element);
}

function applyTemplateToElement(modeler, element, template) {
  const elementTemplates = modeler.get('elementTemplates');
  elementTemplates.set([ template ]);

  elementTemplates.applyTemplate(element, template);
}

function withResolvedState(template, inputValues) {
  const { visibleProperties } = createStateEngine(template, inputValues);

  const properties = visibleProperties.map((property) => {
    if (!property.id || inputValues[property.id] === undefined) {
      return property;
    }

    return {
      ...property,
      value: inputValues[property.id]
    };
  });

  return {
    ...template,
    properties
  };
}
