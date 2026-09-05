import { inject, provide, ref, shallowRef } from 'vue';
import type { InjectionKey, Ref, ShallowRef } from 'vue';

interface FormSubmission {
  isSubmitting: Ref<boolean>;
  submitter: ShallowRef<HTMLElement | null>;
}

const formSubmissionKey: InjectionKey<FormSubmission> = Symbol('genui-form-submission');

export function provideFormSubmission(): FormSubmission {
  const submission: FormSubmission = {
    isSubmitting: ref(false),
    submitter: shallowRef<HTMLElement | null>(null),
  };
  provide(formSubmissionKey, submission);
  return submission;
}

export function useFormSubmission(): FormSubmission | null {
  return inject(formSubmissionKey, null);
}
