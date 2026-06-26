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

// Validates a single constraint against a value. Returns null when the value
// satisfies the constraint, or a human-readable message when it does not.
// Constraints that are not applicable (e.g. length checks on undefined) are
// skipped rather than thrown, matching modeler behaviour.
const checkConstraint = (name, constraint, value) => {
  const str = value === undefined || value === null ? '' : String(value);

  if (name === 'notEmpty') {
    return constraint && str.trim() === '' ? 'Must not be empty' : null;
  }

  if (name === 'minLength') {
    return str.length < constraint ? `Must have at least ${constraint} characters` : null;
  }

  if (name === 'maxLength') {
    return str.length > constraint ? `Must have at most ${constraint} characters` : null;
  }

  if (name === 'pattern') {
    const regex = new RegExp(constraint.value);
    return !regex.test(str) ? (constraint.message ?? `Must match pattern ${constraint.value}`) : null;
  }

  return null;
};

// Aggregates all constraint violations across the currently visible properties.
// Only visible properties are checked — hidden properties are not required
// because they are not written to the BPMN XML and their values are irrelevant.
// Returns an array of { id, label, constraint, message } objects so callers can
// report precisely which fields need attention before applying the template.
export function validateConstraints(visibleProperties, values) {
  return visibleProperties.flatMap((property) => {
    const constraints = property.constraints;
    if (!constraints) {
      return [];
    }

    return Object.entries(constraints).flatMap(([ name, constraint ]) => {
      const message = checkConstraint(name, constraint, values[property.id]);
      return message
        ? [ { id: property.id, label: property.label, constraint: name, message } ]
        : [];
    });
  });
}

// Boolean and Number fields with feel: optional or feel: static are always
// persisted as FEEL expressions by the modeler (prefixed with "="). We mirror
// that here so values flowing into applyTemplate are in the correct format and
// the written BPMN is semantically equivalent to what the modeler would produce.
const FEEL_ALWAYS_TYPES = new Set([ 'Boolean', 'Number' ]);

const isFEELExpression = (value) =>
  typeof value === 'string' && value.trimStart().startsWith('=');

const needsFeelPrefix = (property) =>
  FEEL_ALWAYS_TYPES.has(property.type) &&
  (property.feel === 'optional' || property.feel === 'static');

// Wraps a raw scalar value as a FEEL literal (e.g. true → "= true", 42 → "= 42").
// If the value is already a FEEL expression we leave it untouched to avoid
// double-prefixing when the caller has already done the right thing.
const toFeelLiteral = (value) =>
  isFEELExpression(String(value)) ? String(value) : `= ${value}`;

// Returns a new values map where Boolean / Number fields that the modeler always
// persists as FEEL expressions are normalised accordingly. This prevents the
// BPMN writer from receiving bare "true"/"false" or numeric strings and writing
// them as plain strings instead of FEEL.
export function normalizeFeelValues(visibleProperties, values) {
  return visibleProperties.reduce((acc, property) => {
    if (!property.id || !needsFeelPrefix(property)) {
      return acc;
    }

    const value = acc[property.id];
    if (value === undefined || value === null) {
      return acc;
    }

    return isFEELExpression(String(value))
      ? acc
      : { ...acc, [property.id]: toFeelLiteral(value) };
  }, { ...values });
}

// For feel: "required" properties the modeler enforces that the user enters
// a FEEL expression (i.e. a value starting with "="). We surface the same
// violation here so CLI callers can catch missing expressions before writing
// potentially invalid BPMN. Optional and static FEEL fields are not flagged —
// they accept plain values too (the modeler normalises them automatically, and
// so does normalizeFeelValues above).
export function validateFeel(visibleProperties, values) {
  return visibleProperties.flatMap((property) => {
    if (property.feel !== 'required' || !property.id) {
      return [];
    }

    const value = values[property.id];
    const str = value === undefined || value === null ? '' : String(value);

    return str !== '' && !isFEELExpression(str)
      ? [ { id: property.id, label: property.label, feel: 'required', message: 'Must be a FEEL expression (start with "=")' } ]
      : [];
  });
}


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
