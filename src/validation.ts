import type { WidgetTemplate, WidgetType } from './types/widget';

// Only component inputs belong in widget JSON. Unknown Vue/DOM properties must never
// fall through v-bind (innerHTML, event attributes, srcdoc, dynamic components, etc.).
const box = 'as direction align justify wrap gap padding margin background border flex width height size aspectRatio radius onClickAction onClick'.split(' ');
const text = 'value size weight color textAlign truncate maxLines'.split(' ');
const field = 'modelValue name placeholder variant size disabled'.split(' ');
const props: Record<WidgetType, readonly string[]> = {
  Box: box,
  Row: box,
  Col: box,
  ListView: box,
  ListViewItem: box,
  Card: ['size', 'background', 'radius', 'padding', 'confirm', 'cancel'],
  Button: 'submit label title onClickAction onClick iconStart iconEnd color variant size pill uniform block disabled legacyStyle style iconSize'.split(' '),
  Text: [...text, 'width', 'minLines', 'editable', 'as'],
  Title: [...text, 'as'],
  Caption: text,
  Markdown: ['value', 'streaming'],
  Image: 'src alt frame fit position flush height width size aspectRatio radius'.split(' '),
  Input: [...field, 'inputType', 'required', 'pattern', 'error'],
  Textarea: [...field, 'rows', 'gutterSize', 'autoFocus', 'autoSelect', 'required'],
  Select: [...field, 'options', 'block', 'pill', 'clearable', 'onChangeAction', 'onChange'],
  Checkbox: 'modelValue name label disabled required onChangeAction onChange'.split(' '),
  RadioGroup: 'modelValue name ariaLabel options direction disabled required onChangeAction onChange'.split(' '),
  DatePicker: [...field, 'min', 'max', 'onChangeAction', 'onChange'],
  Form: [...box.filter(key => key !== 'as'), 'onSubmitAction', 'onSubmit', 'submit'],
  Badge: ['label', 'color', 'variant', 'size', 'pill'],
  Divider: ['color', 'size', 'spacing', 'flush'],
  Spacer: ['minSize'],
  Label: ['value', 'fieldName', 'size', 'weight', 'textAlign', 'color'],
  Icon: ['name', 'color', 'size'],
};
const common = new Set(['id', 'key', 'class', 'title', 'role']);
const safeTags = new Set('div span p section article header footer main aside nav ul ol li dl dt dd h1 h2 h3 h4 h5 h6 strong em small blockquote pre code figure figcaption table thead tbody tfoot tr th td caption'.split(' '));
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const booleans = new Set('submit streaming truncate frame flush pill uniform block disabled required clearable error autoFocus autoSelect'.split(' '));
const strings = new Set('as value label title name placeholder inputType pattern variant weight textAlign direction align justify wrap background radius src alt fit position iconStart iconEnd legacyStyle style fieldName ariaLabel min max'.split(' '));
const numeric = new Set(['maxLines', 'minLines', 'rows']);
const dimensions = new Set('size width height gap margin flex aspectRatio iconSize minSize spacing gutterSize'.split(' '));

function isScalar(value: unknown): boolean {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function validateAction(value: unknown, key: string): void {
  if (value !== null && (!isObject(value) || typeof value.type !== 'string')) {
    throw new Error(`Widget action "${key}" must be an action object.`);
  }
}

function validateProperty(type: WidgetType, key: string, value: unknown): void {
  if (key === 'options') {
    if (!Array.isArray(value) || value.some(option => !isScalar(option) && (
      !isObject(option) || typeof option.label !== 'string' || !isScalar(option.value)
    ))) throw new Error(`${type}.options must contain scalar values or label/value objects.`);
    return;
  }
  if (/^on(?:Click|Submit|Change)(?:Action)?$/.test(key) || (type === 'Form' && key === 'submit')) {
    validateAction(value, key);
    return;
  }
  if (value === null) return;
  let valid = true;
  if (key === 'confirm' || key === 'cancel') {
    valid = isObject(value) && typeof value.label === 'string' && isObject(value.action);
    if (valid) validateAction((value as Record<string, unknown>).action, key);
  } else if (key === 'editable') {
    valid = isObject(value) && typeof value.name === 'string'
      && (value.required === undefined || typeof value.required === 'boolean')
      && (value.placeholder === undefined || typeof value.placeholder === 'string');
  } else if (key === 'modelValue') {
    valid = type === 'Checkbox' ? typeof value === 'boolean' : isScalar(value);
  } else if (key === 'padding') {
    valid = typeof value === 'string' || typeof value === 'number' || (isObject(value)
      && Object.entries(value).every(([side, length]) => ['x', 'y', 'top', 'right', 'bottom', 'left'].includes(side)
        && (length === null || typeof length === 'string' || typeof length === 'number')));
  } else if (key === 'border') {
    valid = typeof value === 'string' || typeof value === 'boolean' || (isObject(value)
      && Object.entries(value).every(([part, token]) => ['size', 'style', 'color'].includes(part)
        && (typeof token === 'string' || (part === 'size' && typeof token === 'number'))));
  } else if (key === 'color') {
    valid = typeof value === 'string' || (type === 'Caption' && isObject(value)
      && Object.entries(value).every(([mode, token]) => ['light', 'dark'].includes(mode) && typeof token === 'string'));
  } else if (booleans.has(key)) {
    valid = typeof value === 'boolean';
  } else if (strings.has(key)) {
    valid = typeof value === 'string';
  } else if (numeric.has(key)) {
    valid = typeof value === 'number' && Number.isFinite(value);
  } else if (dimensions.has(key)) {
    valid = typeof value === 'string' || typeof value === 'number';
  }
  if (!valid) throw new Error(`Invalid value for ${type}.${key}.`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function copyJson(value: unknown, depth: number): unknown {
  if (depth > 64) throw new Error('Widget data exceeds the maximum nesting depth.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => copyJson(item, depth + 1));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (forbiddenKeys.has(key)) throw new Error(`Unsupported widget data property "${key}".`);
      return [key, copyJson(item, depth + 1)];
    }));
  }
  throw new Error('Widget properties must contain JSON data only.');
}

function validateImageSource(value: unknown): void {
  if (typeof value !== 'string') throw new Error('Image.src must be a URL string.');
  // Relative URLs, HTTPS/HTTP, blob images and inline image assets are supported.
  const url = new URL(value, 'https://widget.invalid/');
  if (['http:', 'https:', 'blob:'].includes(url.protocol)) return;
  if (url.protocol === 'data:' && /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)(?:;[^,]*)?,/i.test(value)) return;
  throw new Error('Image.src must use an HTTP, HTTPS, blob or image data URL.');
}

/** Validates and snapshots a whole tree before mounting or replacing the last good tree. */
export function validateWidgetTemplate(value: unknown): WidgetTemplate {
  let nodes = 0;
  function visit(node: unknown, depth: number): WidgetTemplate {
    if (depth > 64 || ++nodes > 10000) throw new Error('Widget tree exceeds the maximum size or nesting depth.');
    if (!isObject(node) || typeof node.type !== 'string' || !Object.prototype.hasOwnProperty.call(props, node.type)) {
      throw new Error('Widget type must name a supported component.');
    }
    const type = node.type as WidgetType;
    const result: WidgetTemplate = { type };
    for (const [key, value] of Object.entries(node)) {
      if (key === 'type') continue;
      if (key === 'children') {
        if (!Array.isArray(value)) throw new Error('Widget.children must be an array of widget objects.');
        result.children = value.map(child => visit(child, depth + 1));
        continue;
      }
      const attribute = common.has(key) || /^(?:aria|data)-[a-z][a-z0-9-]*$/.test(key);
      if (!attribute && !props[type].includes(key)) {
        throw new Error(`Unsupported property "${key}" on ${type}.`);
      }
      if (attribute && value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
        throw new Error(`Widget attribute "${key}" must be a scalar value.`);
      }
      if (props[type].includes(key)) validateProperty(type, key, value);
      if (key === 'as' && (typeof value !== 'string' || !safeTags.has(value))) {
        throw new Error('Widget.as must name an allowed layout or text HTML element.');
      }
      if (type === 'Image' && key === 'src') validateImageSource(value);
      result[key] = copyJson(value, depth + 1);
    }
    return result;
  }
  return visit(value, 0);
}
