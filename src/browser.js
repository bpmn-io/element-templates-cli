import Modeler from 'camunda-bpmn-js/lib/camunda-cloud/Modeler';

window.applyTemplate = applyTemplate;

async function applyTemplate(diagram, template, element) {
  const modeler = await importDiagram(diagram);
  const el = getElement(modeler, element);
  applyTemplateToElement(modeler, el, template);

  const xml = await exportDiagram(modeler);

  return xml;
}

async function importDiagram(diagram) {
  const modeler = new Modeler({
    container: document.createElement('div')
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
