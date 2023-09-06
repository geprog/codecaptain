<template>
  <div class="flex flex-col w-full">
    <h1 class="text-2xl font-bold mb-4 text-center">Hey 👋, I will help you understanding your own code 😜</h1>

    <div class="flex flex-wrap gap-4 mt-4 mx-auto">
      <template v-if="repositories">
        <NuxtLink v-for="repo in repositories" :key="repo.id" :to="`/repos/${repo.id}/chat`" :title="repo.name">
          <Card>
            <div class="flex flex-col items-center justify-between p-2 h-full gap-2 w-64">
              <span class="font-bold font-semibold text-2xl mt-2 w-full truncate">{{ repo.name }}</span>
              <UButton size="md" icon="i-heroicons-pencil-square" variant="outline" class="mt-8" label="Chat" />
            </div>
          </Card>
        </NuxtLink>
        <NuxtLink to="/repos/add">
          <Card>
            <div class="flex flex-col items-center justify-between p-2 h-full gap-2 w-64">
              <span class="font-bold font-semibold text-2xl mt-2">Add a repository</span>
              <UButton size="md" icon="i-heroicons-plus" variant="outline" class="mt-8" label="Add" />
            </div>
          </Card>
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: repositories } = await useFetch('/api/repos');
</script>
