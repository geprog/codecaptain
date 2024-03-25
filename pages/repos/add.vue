<template>
  <div class="flex w-full">
    <div class="mx-auto flex flex-col items-center max-w-2xl w-full">
      <h1 class="text-2xl mb-4">Add a new repository</h1>

      <div class="flex mb-4 w-full gap-2">
        <USelectMenu
          v-model="selectedForge"
          color="primary"
          variant="outline"
          :options="forges || []"
          option-attribute="host"
          placeholder="Select a forge ..."
          class="w-1/2"
        />

        <UInput
          color="primary"
          variant="outline"
          :model-value="search"
          placeholder="Search for a repository ..."
          :disabled="!selectedForge"
          size="lg"
          icon="i-heroicons-magnifying-glass-20-solid"
          class="w-1/2"
          @update:model-value="updateSearch"
        />
      </div>

      <div class="w-full rounded-md border border-zinc-400">
        <div v-if="loading" class="p-4">Loading ...</div>

        <div v-else-if="!repositories || repositories.length === 0" class="p-4">No repository found</div>

        <div
          v-else
          v-for="repo in repositories?.slice(0, 5) || []"
          :key="repo.remoteId"
          class="flex border-b border-zinc-200 items-center px-2 py-4 gap-2 w-full min-w-0"
        >
          <img v-if="repo.avatarUrl" :src="repo.avatarUrl" alt="icon" class="w-6 h-6 rounded-md" />
          <UIcon v-else name="i-ion-git-branch" class="w-6 h-6" />
          <span class="font-bold flex-wrap truncate overflow-ellipsis">{{ repo.name }}</span>
          <div class="flex-grow" />
          <UButton v-if="repo.internalId" :to="`/repos/${repo.internalId}/chat`" label="Open" />
          <UButton v-else @click="addRepo(repo.remoteId)" label="Add" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Forge } from '~/server/schemas';

const reposStore = await useRepositoriesStore();
const toast = useToast();

const { data: forges } = await useFetch<Forge[]>('/api/user/forges', {
  default: () => [],
});
const selectedForge = ref<Forge>();

watch(
  forges,
  () => {
    if (!selectedForge.value && forges.value?.length) {
      selectedForge.value = forges.value[0];
    }
  },
  { immediate: true },
);

const search = ref('');
const loading = ref(false);
const { data: repositories } = await useAsyncData(
  async () => {
    if (!selectedForge.value) {
      return Promise.resolve([]);
    }

    loading.value = true;

    try {
      const repos = await $fetch(`/api/forges/${selectedForge.value.id}/repos/search`, {
        method: 'GET',
        query: {
          search: search.value,
        },
      });

      return repos;
    } catch (error) {
      toast.add({
        title: 'Error',
        description: (error as Error).message,
        color: 'red',
      });
    } finally {
      loading.value = false;
    }
  },
  {
    watch: [search, selectedForge],
  },
);

function debounce<T extends Function>(fn: T, ms = 300) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

const updateSearch = debounce((_search: string) => {
  search.value = _search;
}, 500);

async function addRepo(remoteRepoId: string) {
  const forgeId = selectedForge.value?.id;
  if (!forgeId) {
    throw new Error('No forge selected');
  }

  try {
    const repo = await $fetch(`/api/forges/${forgeId}/repos/add`, {
      method: 'POST',
      body: {
        remoteRepoId,
      },
    });
    await reposStore.refresh();
    await navigateTo(`/repos/${repo.id}/chat`);
  } catch (error) {
    toast.add({
      title: 'Error',
      description: (error as Error).message,
      color: 'red',
    });
  }
}
</script>
