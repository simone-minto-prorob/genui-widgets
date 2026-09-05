// @vitest-environment jsdom
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { render } from '../src/render';
import { resolveTemplate } from '../src/template';

describe('widget data boundary', () => {
  it.each(['innerHTML', 'outerHTML', 'onclick', 'srcdoc', 'ref', 'is'])('rejects DOM/Vue property %s before mounting', key => {
    const container = document.createElement('div');
    expect(() => render(container, { type: 'Box', [key]: '<b>inert marker</b>' })).toThrow(/Unsupported property/);
    expect(container.childNodes.length).toBe(0);
  });

  it.each(['script', 'iframe', 'object', 'embed', 'svg', 'style', 'img'])('rejects the dynamic tag %s', as => {
    expect(() => resolveTemplate({ type: 'Text', as, value: 'marker' })).toThrow(/allowed layout/);
  });

  it('validates descendants before replacing the last good tree', async () => {
    const container = document.createElement('div');
    const widget = render(container, { type: 'Text', value: 'Last good widget' });
    expect(() => widget.update({ type: 'Box', children: [{ type: 'Text', innerHTML: '<b>marker</b>' }] })).toThrow();
    await nextTick();
    expect(container.textContent).toBe('Last good widget');
    widget.destroy();
  });

  it.each([
    { type: 'Markdown' as const, value: 123 },
    { type: 'Select' as const, options: [null] },
    { type: 'RadioGroup' as const, options: [{ label: 'broken' }] },
    { type: 'Button' as const, color: 123 },
    { type: 'Box' as const, border: { size: { toString: 'invalid' } } },
    { type: 'Box' as const, padding: { top: {} } },
  ])('rejects invalid component data before a Vue update', async template => {
    const container = document.createElement('div');
    const widget = render(container, { type: 'Text', value: 'Last good' });
    expect(() => widget.update(template)).toThrow();
    await nextTick();
    expect(container.textContent).toBe('Last good');
    widget.destroy();
  });

  it('rejects nested template strings and prototype keys as JSON data', () => {
    expect(() => resolveTemplate(JSON.stringify({ type: 'Box', children: ['{{ title }}'] }))).toThrow();
    expect(() => resolveTemplate('{"type":"Box","__proto__":{"innerHTML":"marker"}}')).toThrow();
  });

  it('allows intended attributes, structural tags and escaped text', async () => {
    const container = document.createElement('div');
    const widget = render(container, { type: 'Text', as: 'h3', id: 'safe', 'aria-label': 'Heading', value: '<b>plain text</b>' });
    await nextTick();
    expect(container.querySelector('h3')?.textContent).toBe('<b>plain text</b>');
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('h3')?.getAttribute('aria-label')).toBe('Heading');
    widget.destroy();
  });

  it.each(['javascript:marker', 'data:text/html,marker', 'file:///marker'])('rejects non-image URL %s', src => {
    expect(() => resolveTemplate({ type: 'Image', src })).toThrow(/Image.src/);
  });

  it('keeps Markdown sanitization active', async () => {
    const container = document.createElement('div');
    const widget = render(container, { type: 'Markdown', value: '<img src="data:text/plain,marker" onerror="void 0"><b>safe</b>' });
    await nextTick();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.textContent).toContain('safe');
    widget.destroy();
  });

  it('requires explicit opt-in for Jinja, retaining braces as text in JSON', () => {
    const template = '{"type":"Text","value":{{ title | tojson }}}';
    expect(() => resolveTemplate(template, { title: 'Hello' })).toThrow();
    expect(resolveTemplate(template, { title: 'Hello' }, true).value).toBe('Hello');
    expect(resolveTemplate('{"type":"Text","value":"{{ title }}"}', { title: 'Hello' }).value).toBe('{{ title }}');
  });

  it('validates trusted Jinja output and preserves context on a failed update', async () => {
    const container = document.createElement('div');
    const template = '{"type":"Text","value":{{ title | tojson }}}';
    const widget = render(container, template, { allowJinjaTemplates: true, templateContext: { title: 'original' } });
    expect(() => widget.update('{"type":"Box","innerHTML":{{ title | tojson }}}', { title: 'bad' })).toThrow();
    widget.update(template);
    await nextTick();
    expect(container.textContent).toBe('original');
    widget.destroy();
  });
});
