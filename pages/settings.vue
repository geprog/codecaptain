<template>
  <div>
    <h1 class="text-2xl font-bold">Settings</h1>

    <h1 class="text-xl font-bold mt-4">Forges</h1>

    <div class="flex flex-wrap gap-4 mt-2">
      <NuxtLink v-for="forge in forges" :key="forge.id" :to="`/forges/${forge.id}`" :title="forge.host">
        <Card>
          <div class="flex flex-col items-center justify-between p-2 h-full gap-2 w-64">
            <div class="flex items-center gap-2 mt-2 mx-auto">
              <UIcon v-if="forge.type === 'github'" name="i-ion-logo-github" class="w-6 h-6" />
              <UIcon v-if="forge.type === 'gitlab'" name="i-ion-logo-gitlab" class="w-6 h-6" />
              <span class="font-semibold text-xl truncate text-center">{{ forge.host }}</span>
            </div>

            <UButton size="md" icon="i-heroicons-pencil-square" variant="outline" class="mt-8" label="Edit" />
          </div>
        </Card>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const { forges } = await useForgesStore();
</script>
