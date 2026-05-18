import { createModeler, getElement, applyTemplateToElement, exportDiagram } from './modeler.js';

export async function applyTemplate(diagram, template, element) {
  const parsedTemplate = JSON.parse(template);

  const modeler = await createModeler(diagram);
  const el = getElement(modeler, element);
  applyTemplateToElement(modeler, el, parsedTemplate);

  const xml = await exportDiagram(modeler);

  return xml;
}
