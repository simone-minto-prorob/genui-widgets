import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WidgetText from '../src/components/Text.vue';

describe('editable Text', () => {
  it('preserves a user draft across style updates and applies a changed server value', async () => {
    const wrapper = mount(WidgetText, { props: { value: 'Server value', editable: { name: 'message' } } });
    try {
      const textarea = wrapper.get('textarea');
      expect(textarea.element.value).toBe('Server value');
      await textarea.setValue('Unsaved user draft');
      await wrapper.setProps({ value: 'Server value', size: 'lg', minLines: 3 });
      expect(textarea.element.value).toBe('Unsaved user draft');

      await wrapper.setProps({ value: 'Updated server value' });
      expect(textarea.element.value).toBe('Updated server value');
    } finally {
      wrapper.unmount();
    }
  });

  it('grows after typing and server updates and initializes when editing is enabled later', async () => {
    const wrapper = mount(WidgetText, { props: { value: 'Initial text' } });
    try {
      await wrapper.setProps({ editable: { name: 'message' } });
      const textarea = wrapper.get('textarea');
      expect(textarea.element.value).toBe('Initial text');
      expect(textarea.element.style.height).not.toBe('');
      Object.defineProperty(textarea.element, 'scrollHeight', {
        configurable: true,
        get: () => 24 + textarea.element.value.length * 2,
      });

      await textarea.setValue('A longer user draft');
      expect(textarea.element.style.height).toBe(`${24 + 'A longer user draft'.length * 2}px`);
      await wrapper.setProps({ value: 'Short' });
      expect(textarea.element.value).toBe('Short');
      expect(textarea.element.style.height).toBe(`${24 + 'Short'.length * 2}px`);
    } finally {
      wrapper.unmount();
    }
  });
});
