import {
  setPropertyValue,
  validateProperty,
  applyConditions
} from 'bpmn-js-element-templates/util';

import { createModeler, getElement, applyTemplateToElement, exportDiagram } from './modeler.js';

export async function setFields(diagram, template, elementId, values) {
  const parsedTemplate = JSON.parse(template);

  const modeler = await createModeler(diagram);
  const element = getElement(modeler, elementId);
  applyTemplateToElement(modeler, element, parsedTemplate);

  const bpmnFactory = modeler.get('bpmnFactory');
  const commandStack = modeler.get('commandStack');

  // Build groups lookup: group id -> group label
  const groupsMap = {};
  for (const group of (parsedTemplate.groups || [])) {
    groupsMap[group.id] = group.label;
  }

  // Process values with cascading condition re-evaluation
  const pendingKeys = new Set(Object.keys(values));
  const maxIterations = pendingKeys.size + 1;
  let iteration = 0;

  while (pendingKeys.size > 0) {

    if (++iteration > maxIterations) {
      throw new Error(
        'Maximum iteration limit reached during cascading condition evaluation. ' +
        'This may indicate circular conditions in the template.'
      );
    }

    const filtered = applyConditions(element, parsedTemplate);
    const visibleProps = filtered.properties.filter(p => p.type !== 'Hidden' && p.label);

    let progress = false;

    for (const key of [ ...pendingKeys ]) {
      const prop = resolveProperty(key, visibleProps, groupsMap);

      if (!prop) {
        continue;
      }

      const value = values[key];

      // Validate against constraints
      const error = validateProperty(value, prop);
      if (error) {
        throw new Error(`Validation failed for "${key}": ${error}`);
      }

      // Set the value on the BPMN model
      setPropertyValue(bpmnFactory, commandStack, element, prop, value);

      pendingKeys.delete(key);
      progress = true;
    }

    if (!progress) {
      const remaining = [ ...pendingKeys ].join(', ');
      throw new Error(
        `Could not resolve fields: ${remaining}. ` +
        'They may not be visible given the current property values, ' +
        'or the labels do not match any known property.'
      );
    }
  }

  return await exportDiagram(modeler);
}

function resolveProperty(key, visibleProps, groupsMap) {

  // Check for disambiguation suffix pattern: "Label (N)"
  const suffixMatch = key.match(/^(.+) \((\d+)\)$/);

  if (suffixMatch) {
    return resolveNthLabel(suffixMatch[1], parseInt(suffixMatch[2]), visibleProps, groupsMap);
  }

  // Try plain label match
  const byLabel = visibleProps.filter(p => p.label === key);

  if (byLabel.length === 1) {
    return byLabel[0];
  }

  // Ambiguous plain label — require section qualification
  if (byLabel.length > 1) {
    throw new Error(
      `Ambiguous label "${ key }" matches ${ byLabel.length } fields. ` +
      'Use "Section.Label" format to disambiguate.'
    );
  }

  // Try section-qualified: "Section.Label"
  const dotIdx = key.indexOf('.');

  if (dotIdx > 0) {
    const section = key.slice(0, dotIdx);
    const label = key.slice(dotIdx + 1);

    return visibleProps.find(p => {
      const sectionName = p.group
        ? (groupsMap[p.group] || p.group)
        : 'General';
      return sectionName === section && p.label === label;
    });
  }

  // Not found among visible props (may become visible after other changes)
  return null;
}

/**
 * Resolve the Nth occurrence of a label within a section,
 * matching the disambiguation convention used by queryFields.
 *
 * @param {string} label - the base label (without suffix)
 * @param {number} n - occurrence index (2 = second occurrence)
 * @param {Array} visibleProps
 * @param {Object} groupsMap
 * @return {Object|null}
 */
function resolveNthLabel(label, n, visibleProps, groupsMap) {
  let count = 0;

  for (const prop of visibleProps) {
    if (prop.label !== label) {
      continue;
    }

    count++;

    // First occurrence has no suffix, second is (2), third is (3), etc.
    if (count === n) {
      return prop;
    }
  }

  return null;
}
