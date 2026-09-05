<script setup lang="ts">

    import Box from './Box.vue';
    import { useActionDispatcher } from '../composables/useActionDispatcher';
    import { provideFormSubmission } from '../composables/useFormSubmission';
    import type { WidgetAction } from '../types/widget';

    const props = defineProps({
        onSubmitAction: {
            type: Object,
            default: null,
        },
    });

    const { dispatchAction } = useActionDispatcher();
    const { isSubmitting, submitter } = provideFormSubmission();

    const handleSubmit = async (e: Event) => {
        e.preventDefault();

        if (!props.onSubmitAction || isSubmitting.value) return;

        isSubmitting.value = true;
        submitter.value = (e as SubmitEvent).submitter ?? null;
        try {
            await dispatchAction(props.onSubmitAction as WidgetAction);
        } finally {
            isSubmitting.value = false;
            submitter.value = null;
        }
    };
</script>

<template>
    <Box as="form"
         class="genui-form"
         :aria-busy="isSubmitting || undefined"
         @submit="handleSubmit"
    >
        <slot />
    </Box>
</template>

<style lang="scss">
.genui-form {
    width: 100%;
}
</style>
