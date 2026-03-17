const areEqual = (a, b) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((key) => a[key] === b[key]);

// Never overwrite a value the caller explicitly provided — only fill in defaults
// for properties that the caller left unspecified.
const applyPropertyDefault = (values, property) =>
  property.id !== undefined && property.value !== undefined && values[property.id] === undefined
    ? { ...values, [property.id]: property.value }
    : values;

// Seed the value map with template defaults, but only for currently visible
// properties. Defaults of hidden properties must not bleed into the value map
// because their presence could accidentally satisfy conditions and make
// unrelated fields appear visible.
const resolveValues = (visibleProperties, inputValues) =>
  visibleProperties.reduce(applyPropertyDefault, { ...inputValues });

// A single convergence step: re-evaluate which properties are visible given the
// current values, then derive the next set of values from those visible defaults.
// Returning `stable` lets the outer loop bail out early instead of always
// running to the maximum iteration count.
const resolveStep = (properties, inputValues) => (values) => {
  const visibleProperties = properties.filter((property) =>
    isConditionVisible(property.condition, values)
  );
  const nextValues = resolveValues(visibleProperties, inputValues);

  return { values: nextValues, visibleProperties, stable: areEqual(values, nextValues) };
};

// Visibility and values are mutually dependent: a newly visible property may
// carry a default that changes which other properties become visible. We
// iterate until the value map stops changing (fixed point). Capping iterations
// at properties.length + 1 guarantees termination even if the template has
// circular or pathological conditions.
export function createStateEngine(template, inputValues = {}) {
  const properties = template.properties || [];
  const step = resolveStep(properties, inputValues);

  const { values, visibleProperties } = Array.from(
    { length: properties.length + 1 }
  ).reduce(
    ({ values, visibleProperties, stable }) =>
      stable ? { values, visibleProperties, stable } : step(values),
    { values: { ...inputValues }, visibleProperties: [], stable: false }
  );

  return { values, visibleProperties };
}

// Mirrors the condition evaluation logic of the Camunda web modeler so that
// CLI-driven template application honours the same show/hide rules a user would
// experience interactively. Conditions are evaluated purely against an in-memory
// value map - no DOM, no React, no modeler instance needed.
export function isConditionVisible(condition, values) {
  if (!condition) {
    return true;
  }

  // Composite conditions delegate to the same evaluator recursively so that
  // nesting depth is unlimited without duplicating any evaluation logic.
  if (condition.allMatch) {
    return condition.allMatch.every((entry) => isConditionVisible(entry, values));
  }

  if (condition.anyMatch) {
    return condition.anyMatch.some((entry) => isConditionVisible(entry, values));
  }

  if (!condition.property) {
    throw new Error('Condition must define "property"');
  }

  if (condition.equals !== undefined) {
    return values[condition.property] === condition.equals;
  }

  if (condition.oneOf) {
    return condition.oneOf.includes(values[condition.property]);
  }

  // Fail loudly so unsupported condition shapes surface at evaluation time
  // rather than silently hiding fields that should be visible.
  throw new Error(`Unsupported condition for property "${condition.property}"`);
}
