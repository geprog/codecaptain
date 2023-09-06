<template>
  <div class="mx-auto flex flex-col items-center max-w-2xl w-full">
    <h1 class="text-2xl mb-4">Add a new repository</h1>

    <div class="flex gap-1 mb-4 w-full">
      <div class="flex-grow">
        <USelectMenu
          searchable
          searchable-placeholder="Search a forge ..."
          :search-attributes="['host']"
          option-attribute="host"
          value-attribute="id"
          placeholder="Select a forge ..."
          size="lg"
          v-model="selectedForgeId"
          :options="forges?.filter((f) => f.isConnected)"
        >
          <template #label>
            <UIcon name="i-ion-code" class="w-4 h-4" />
            {{ selectedForge?.host }}
          </template>
        </USelectMenu>
      </div>

      <div class="flex-grow">
        <UInput
          color="primary"
          variant="outline"
          :model-value="search"
          placeholder="Search for a repository ..."
          :disabled="!selectedForge"
          size="lg"
          icon="i-heroicons-magnifying-glass-20-solid"
          @update:model-value="updateSearch"
        />
      </div>
    </div>

    <div v-if="selectedForge" class="w-full rounded-md border border-zinc-400">
      <div v-if="search.length < 3" class="p-4">Start typing to search for a repository</div>
      <div v-else-if="!repositories || repositories.length === 0" class="p-4">No repository found</div>

      <div
        v-for="repo in repositories"
        :key="repo.id"
        class="flex border-b border-zinc-200 items-center px-2 py-4 gap-2 w-full min-w-0"
      >
        <UIcon name="i-ion-git-branch" class="!w-16" />
        <span class="font-bold flex-wrap truncate overflow-ellipsis">{{ repo.name }}</span>
        <div class="flex-grow" />
        <UButton v-if="repo.active" :href="`/repos/${repo.id}/chat`" label="Open" />
        <UButton v-else @click="cloneRepo(repo.id)" label="Import" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const loading = ref(false);
const { data: forges } = await useFetch('/api/user/forges');
const selectedForgeId = ref(forges.value?.[0]?.id);
const selectedForge = computed(() => forges.value?.find((f) => f.id === selectedForgeId.value));

const search = ref('');
const { data: repositories } = await useAsyncData(
  () => {
    if (!selectedForge.value || search.value.length < 1) {
      return Promise.resolve([]);
    }

    return $fetch(`/api/forges/${selectedForge.value.id}/repos/search`, {
      method: 'GET',
      query: {
        search: search.value,
      },
      credentials: 'include', // TODO why unauthorized?
    });
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

async function cloneRepo(remoteRepoId: string) {
  loading.value = true;
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
    await navigateTo(`/repos/${repo.id}/chat`);
  } catch (error) {
    console.error(error);
  }

  loading.value = false;
}
</script>
