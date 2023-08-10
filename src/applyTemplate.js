import Modeler from 'bpmn-js-headless/lib/Modeler.js';
import ZeebeModdleExtension from 'zeebe-bpmn-moddle/resources/zeebe.json';
import ElementTemplates from 'bpmn-js-element-templates/cloud-core';

export async function applyTemplate(diagram, template, element) {
  const parsedTemplate = JSON.parse(template);

  const modeler = await importDiagram(diagram);
  const el = getElement(modeler, element);
  applyTemplateToElement(modeler, el, parsedTemplate);

  const xml = await exportDiagram(modeler);

  return xml;
}

async function importDiagram(diagram) {
  const modeler = new Modeler({
    additionalModules: [
      ElementTemplates
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
