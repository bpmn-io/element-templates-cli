
import { validateZeebe as _validate } from '@bpmn-io/element-templates-validator';

export function validate(template) {
  const parsedTemplate = JSON.parse(template);

  return _validate(parsedTemplate);
}
