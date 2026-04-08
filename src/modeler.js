import Modeler from 'bpmn-js-headless/lib/Modeler';
import ZeebeModdleExtension from 'zeebe-bpmn-moddle/resources/zeebe.json';
import { CloudElementTemplatesCoreModule } from 'bpmn-js-element-templates/core';

export async function createModeler(diagram) {
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

export function getElement(modeler, elementId) {
  const elementRegistry = modeler.get('elementRegistry');
  const element = elementRegistry.get(elementId);

  if (!element) {
    throw new Error(`Element "${ elementId }" not found in diagram`);
  }

  return element;
}

export function applyTemplateToElement(modeler, element, template) {
  const elementTemplates = modeler.get('elementTemplates');
  elementTemplates.set([ template ]);

  elementTemplates.applyTemplate(element, template);
}

export async function exportDiagram(modeler) {
  const result = await modeler.saveXML({
    format: true
  });

  return result.xml;
}
