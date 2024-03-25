<template>
  <div class="flex flex-col w-full">
    <div class="flex w-full">
      <h1 class="text-2xl font-bold">Hey 👋, I will help you understanding your own code 😜</h1>
      <NuxtLink to="/repos/add" class="ml-auto">
        <UButton size="md" icon="i-heroicons-plus" variant="outline" color="green" label="Add repo" />
      </NuxtLink>
    </div>

    <div class="flex flex-wrap gap-4 mt-4">
      <template v-if="repositories">
        <NuxtLink v-for="repo in repositories" :key="repo.id" :to="`/repos/${repo.id}/chat`" :title="repo.name">
          <Card>
            <div class="flex flex-col items-center justify-between p-2 h-full gap-2 w-64">
              <div class="flex items-center gap-2 mt-2 mx-auto">
                <img v-if="repo.avatarUrl" :src="repo.avatarUrl" alt="icon" class="w-6 h-6 rounded-md" />
                <UIcon v-else name="i-ion-git-branch" class="w-6 h-6" />
                <span class="font-semibold text-lg truncate">{{ repo.name }}</span>
              </div>
              <UButton size="md" icon="i-heroicons-pencil-square" variant="outline" class="mt-8" label="Chat" />
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
