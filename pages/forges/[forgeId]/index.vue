<template>
  <div v-if="forge" class="flex flex-col w-full items-center">
    <h1 class="text-2xl mb-8">{{ forge.host }}</h1>

    <UForm ref="form" :schema="schema" :state="forge" @submit="submit" class="flex flex-col w-full max-w-2xl gap-2">
      <UFormGroup label="Host" name="host">
        <UInput v-model="forge.host" disabled />
      </UFormGroup>

      <UFormGroup label="Type" name="type">
        <UInput v-model="forge.type" disabled />
      </UFormGroup>

      <ForgeOAuthConfig
        :forge-type="forge.type"
        :forge-host="forge.host"
        v-model:forge-client-id="forge.clientId"
        v-model:forge-client-secret="forge.clientSecret"
      />

      <div class="flex mt-4 gap-2 justify-center">
        <UButton label="Delete forge" icon="i-heroicons-trash" color="red" @click="deleteForge" />
        <UButton type="submit" label="Update forge" icon="i-heroicons-arrow-path-20-solid" />
      </div>
    </UForm>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod';

const schema = z.object({
  host: z.string().nonempty(),
  clientId: z.string().nonempty(),
  clientSecret: z.string().nonempty(),
});

const route = useRoute();
const forgesStore = await useForgesStore();
const forgeId = route.params.forgeId;
const { data: forge } = await useFetch(`/api/forges/${forgeId}`);

const form = ref<HTMLFormElement>();

const toast = useToast();

async function submit() {
  await form.value!.validate();

  await $fetch(`/api/forges/${forgeId}`, {
    method: 'PATCH',
    body: forge.value,
  });

  await forgesStore.refresh();

  toast.add({
    title: 'Forge updated',
    description: `Forge ${forge.value!.host} updated successfully`,
    color: 'green',
  });
}

async function deleteForge() {
  if (!forge.value) {
    return;
  }

  if (!confirm(`Do you want to remove the forge ${forge.value.host}`)) {
    return;
  }

  await $fetch(`/api/forges/${forgeId}`, {
    method: 'DELETE',
  });

  await forgesStore.refresh();

  toast.add({
    title: 'Forge removed',
    description: `Forge ${forge.value!.host} removed successfully`,
    color: 'green',
  });

  await navigateTo('/');
}
</script>
