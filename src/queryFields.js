import {
  getPropertyValue,
  applyConditions
} from 'bpmn-js-element-templates/util';

import { createModeler, getElement, applyTemplateToElement } from './modeler.js';

const DEFAULT_GROUP = 'General';

export async function queryFields(diagram, template, elementId) {
  const parsedTemplate = JSON.parse(template);

  const modeler = await createModeler(diagram);
  const element = getElement(modeler, elementId);
  applyTemplateToElement(modeler, element, parsedTemplate);

  // Filter to visible properties (conditions evaluated)
  const filtered = applyConditions(element, parsedTemplate);
  const visibleProps = filtered.properties.filter(p => p.type !== 'Hidden' && p.label);

  // Build groups lookup: group id -> group label
  const groupsMap = {};
  for (const group of (parsedTemplate.groups || [])) {
    groupsMap[group.id] = group.label;
  }

  // Build output organized by sections
  const result = {};

  for (const prop of visibleProps) {
    const sectionName = prop.group
      ? (groupsMap[prop.group] || prop.group)
      : DEFAULT_GROUP;

    if (!result[sectionName]) {
      result[sectionName] = {};
    }

    const entry = {
      value: getPropertyValue(element, prop),
      type: prop.type
    };

    if (prop.description) {
      entry.description = prop.description;
    }

    if (prop.type === 'Dropdown' && prop.choices) {
      entry.choices = prop.choices;
    }

    if (prop.feel) {
      entry.feel = prop.feel;
    }

    if (prop.constraints) {
      entry.constraints = prop.constraints;
    }

    // Disambiguate duplicate labels within the same section
    let label = prop.label;

    if (result[sectionName][label]) {
      let suffix = 2;

      while (result[sectionName][`${ label } (${ suffix })`]) {
        suffix++;
      }

      label = `${ label } (${ suffix })`;
    }

    result[sectionName][label] = entry;
  }

  return result;
}
