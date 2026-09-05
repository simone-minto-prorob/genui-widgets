import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import DynamicWidget from '../src/components/DynamicWidget.vue';
import type { ActionEventDetail } from '../src/types/action';
import type { WidgetTemplate } from '../src/types/widget';

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function formTemplate(): WidgetTemplate {
  return {
    type: 'Form',
    onSubmitAction: { type: 'save' },
    children: [
      { type: 'Input', name: 'title', modelValue: 'Draft title', required: true },
      { type: 'Checkbox', name: 'notify', modelValue: true },
      { type: 'Button', label: 'Save', submit: true },
      { type: 'Button', label: 'Save and continue', submit: true },
      { type: 'Button', label: 'Preview', onClickAction: { type: 'preview' } },
    ],
  };
}

describe('form submissions', () => {
  it('keeps the submitter loading and prevents repeated mouse and keyboard submissions until completion', async () => {
    const pending = deferred();
    const wrapper = mount(DynamicWidget, { props: { template: formTemplate() }, attachTo: document.body });
    try {
      const details: ActionEventDetail[] = [];
      wrapper.element.addEventListener('genui-action', (event: Event) => {
        const detail = (event as CustomEvent<ActionEventDetail>).detail;
        details.push(detail);
        detail.waitUntil(pending.promise);
      });
      const form = wrapper.get('form').element as HTMLFormElement;
      const [submitter, alternative, preview] = wrapper.findAll('button').map((button) => button.element);

      submitter.click();
      submitter.click();
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
      expect(details).toHaveLength(1);
      expect(details[0].formData).toEqual({ title: 'Draft title', notify: 'on' });

      await nextTick();
      expect(submitter.disabled).toBe(true);
      expect(submitter.querySelector('.genui-loader')).not.toBeNull();
      expect(alternative.disabled).toBe(true);
      expect(alternative.querySelector('.genui-loader')).toBeNull();
      expect(preview.disabled).toBe(false);
      expect(form.getAttribute('aria-busy')).toBe('true');

      pending.resolve();
      await flushPromises();
      expect(submitter.disabled).toBe(false);
      expect(alternative.disabled).toBe(false);
      expect(submitter.querySelector('.genui-loader')).toBeNull();
      expect(form.hasAttribute('aria-busy')).toBe(false);
      submitter.click();
      await flushPromises();
      expect(details).toHaveLength(2);
    } finally {
      pending.resolve();
      wrapper.unmount();
    }
  });

  it('guards implicit submissions without a submitter and unlocks after a rejected handler', async () => {
    const pending = deferred();
    const errorHandler = vi.fn();
    const wrapper = mount(DynamicWidget, {
      props: { template: formTemplate() },
      attachTo: document.body,
      global: { config: { errorHandler } },
    });
    try {
      const onAction = vi.fn((event: Event) => {
        if (onAction.mock.calls.length === 1) {
          (event as CustomEvent<ActionEventDetail>).detail.waitUntil(pending.promise);
        }
      });
      wrapper.element.addEventListener('genui-action', onAction);
      const form = wrapper.get('form').element;
      const submit = () => form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

      submit();
      submit();
      await nextTick();
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(wrapper.findAll<HTMLButtonElement>('button[type="submit"]').every((button) => button.element.disabled)).toBe(true);

      const error = new Error('Save failed');
      pending.reject(error);
      await flushPromises();
      expect(errorHandler).toHaveBeenCalledWith(error, expect.anything(), expect.any(String));
      expect(wrapper.findAll<HTMLButtonElement>('button[type="submit"]').every((button) => !button.element.disabled)).toBe(true);
      submit();
      await flushPromises();
      expect(onAction).toHaveBeenCalledTimes(2);
    } finally {
      pending.resolve();
      wrapper.unmount();
    }
  });

  it('preserves normal button action loading and form data without starting a form submission', async () => {
    const pending = deferred();
    const wrapper = mount(DynamicWidget, { props: { template: formTemplate() }, attachTo: document.body });
    try {
      const details: ActionEventDetail[] = [];
      wrapper.element.addEventListener('genui-action', (event: Event) => {
        const detail = (event as CustomEvent<ActionEventDetail>).detail;
        details.push(detail);
        detail.waitUntil(pending.promise);
      });
      const preview = wrapper.get<HTMLButtonElement>('button[type="button"]').element;
      preview.click();
      preview.click();
      await nextTick();
      expect(details).toHaveLength(1);
      expect(details[0].action.type).toBe('preview');
      expect(details[0].formData).toEqual({ title: 'Draft title', notify: 'on' });
      expect(preview.disabled).toBe(true);
      expect(preview.querySelector('.genui-loader')).not.toBeNull();
      expect(wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled).toBe(false);
      expect(wrapper.get('form').attributes('aria-busy')).toBeUndefined();

      pending.resolve();
      await flushPromises();
      expect(preview.disabled).toBe(false);
      expect(preview.querySelector('.genui-loader')).toBeNull();
    } finally {
      pending.resolve();
      wrapper.unmount();
    }
  });
});
