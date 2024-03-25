<template>
  <aside class="fixed h-screen pb-12 lg:inset-y-0 lg:w-72 lg:flex-col hidden lg:block">
    <NuxtLink
      class="flex items-center px-8 py-6 text-2xl font-semibold tracking-tight duration-200 cursor-pointer stroke-stone-800 dark:text-stone-200 dark:stroke-stone-500 dark:hover:stroke-white hover:stroke-stone-700 hover:text-stone-700 dark:hover:text-white"
      to="/"
    >
      <img src="/logo_light.svg" alt="CodeCaptain logo" class="w-8 dark:hidden" />
      <img src="/logo_dark.svg" alt="CodeCaptain dark logo" class="w-8 hidden dark:block" />
      <span
        class="ml-2 text-transparent bg-gradient-to-tr from-gray-800 to-gray-400 dark:from-gray-100 dark:to-gray-400 bg-clip-text"
        >Code</span
      >
      <span>captain.ai</span>
    </NuxtLink>
    <div class="space-y-4">
      <div class="px-6 py-2">
        <h2 class="px-2 mb-2 text-lg font-semibold tracking-tight">Workspace</h2>
        <div class="space-y-1">
          <MenuItem to="/" title="Repos" icon="i-mdi-source-branch" />
          <MenuItem to="/settings" title="Settings" icon="i-ion-ios-settings" />
          <MenuItem to="https://geprog.com" title="Geprog" icon="i-ion-android-favorite-outline" target="_blank" />
        </div>
      </div>
      <div class="py-2">
        <h2 class="relative px-8 text-lg font-semibold tracking-tight">Repos</h2>
        <div dir="ltr" class="relative overflow-hidden px-4">
          <div data-radix-scroll-area-viewport="" class="h-full w-full rounded-[inherit]">
            <div class="p-2 space-y-1">
              <div v-for="repo in repos" :key="repo.id">
                <MenuItem
                  :to="`/repos/${repo.id}/chat`"
                  :title="repo.name"
                  :img="repo.avatarUrl || undefined"
                  icon="i-mdi-source-branch"
                />
              </div>

              <MenuItem to="/repos/add" title="Add repo" icon="i-heroicons-plus" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="user" class="absolute inset-x-0 mx-6 bottom-8">
      <UPopover>
        <button
          type="button"
          class="flex items-center justify-between gap-4 px-2 py-1 rounded lg:w-full hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          <div class="flex flex-row-reverse items-center justify-start w-full gap-4 lg:flex-row">
            <UAvatar v-if="user.avatarUrl" :src="user.avatarUrl" size="md" alt="Avatar" />

            <div class="flex flex-row-reverse items-center gap-4 lg:gap-1 lg:items-start lg:flex-col">
              <span class="text-ellipsis overflow-hidden whitespace-nowrap max-w-[8rem]">{{ user.name }}</span>
              <span
                class="inline-flex items-center font-medium py-0.5 text-xs uppercase rounded-md text-stone-800 dark:text-stone-300"
                >FREE</span
              >
            </div>
          </div>

          <UIcon name="i-ion-chevron-expand-outline" />
        </button>

        <template #panel>
          <UVerticalNavigation :links="links" class="w-48" />
        </template>
      </UPopover>
    </div>
  </aside>
</template>

<script setup lang="ts">
const { user, logout } = await useAuth();
const colorMode = useColorMode();
const { repos } = await useRepositoriesStore();

const isDark = computed({
  get() {
    return colorMode.value === 'dark';
  },
  set() {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
  },
});

const links = computed(() => [
  {
    label: 'Theme',
    icon: isDark.value ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid',
    click: () => {
      isDark.value = !isDark.value;
    },
  },
  {
    label: 'Logout',
    icon: 'i-ion-log-out-outline',
    click: logout,
  },
]);
</script>
