<template>
  <div v-if="loading || !repo" class="flex w-full items-center justify-center">
    <span class="m-auto text-2xl">Synchronizing and indexing your repository ...</span>
  </div>
  <div v-else class="flex items-center flex-col w-full flex-grow">
    <div class="flex w-full p-2 items-center">
      <span class="mx-auto text-2xl">{{ repo.name }}</span>

      <NuxtLink :to="repo.url" target="_blank">
        <UButton icon="i-ion-git-pull-request" variant="outline" label="Open repo" />
      </NuxtLink>

      <UButton icon="i-ion-cloud-download-outline" label="Sync repo" variant="outline" class="ml-2" @click="reIndex" />
    </div>

    <div class="flex-1 flex w-full max-w-4xl flex-col p-4 gap-4 items-center overflow-y-auto">
      <!-- Chat history section -->
      <div
        v-for="message in chatHistory"
        :key="message.id"
        class="flex w-full gap-2"
        :class="{
          'justify-end': message.sender === 'user',
        }"
      >
        <template v-if="message.sender === 'user'">
          <div class="w-10 flex-shrink-0" />
          <UAlert title="" color="primary" variant="subtle">
            <template #title>
              <vue-markdown :source="message.text" />
            </template>
          </UAlert>
          <div class="flex items-center justify-center rounded w-10 h-10 p-2 flex-shrink-0">
            <span class="text-2xl">💁</span>
          </div>
        </template>
        <template v-else-if="message.sender === 'error'">
          <div class="flex items-center justify-center w-10 h-10 p-2 flex-shrink-0">
            <span class="text-2xl">❌</span>
          </div>
          <UAlert title="" color="red" variant="subtle">
            <template #title>
              <vue-markdown :source="message.text" />
            </template>
          </UAlert>
          <div class="w-10 flex-shrink-0" />
        </template>
        <template v-else>
          <div class="flex items-center justify-center rounded w-10 h-10 p-2 flex-shrink-0">
            <span class="text-2xl">🤖</span>
          </div>
          <UAlert title="" color="violet" variant="subtle">
            <template #title>
              <vue-markdown :source="message.text" />
            </template>
          </UAlert>
          <div class="w-10 flex-shrink-0" />
        </template>
      </div>

      <div v-if="thinking" class="flex w-full p-2 gap-2">
        <div class="w-10" />
        <span class="text-2xl">🤔</span>
        <p>Thinking ...</p>
      </div>
    </div>

    <div v-if="chatHistory.length < 2" class="flex gap-4">
      <UButton size="lg" label="What is this project about?" @click="askQuestion('What is this project about?')" />
      <UButton
        size="lg"
        label="Which programming languages are used in this project?"
        @click="askQuestion('Which programming languages are used in this project?')"
      />
      <UButton
        size="lg"
        label="Could you explain the technical project structure to me?"
        @click="askQuestion('Could you explain the technical project structure to me?')"
      />
    </div>

    <div class="flex my-4 mx-12 w-full max-w-4xl justify-center gap-2">
      <div class="flex-grow">
        <UInput
          v-model="inputText"
          color="primary"
          variant="outline"
          size="lg"
          placeholder="Type a message..."
          @keydown.enter="sendMessage"
        />
      </div>

      <input type="checkbox" id="inputCheck" hidden />

      <label for="inputCheck" class="fab-btn flex items-center justify-center cursor-pointer" @click="sendMessage">
        <UButton icon="i-mdi-send" size="lg" :ui="{ rounded: 'rounded-full' }" @click="sendMessage" />
      </label>
    </div>
  </div>
</template>

<script lang="ts" setup>
import VueMarkdown from 'vue-markdown-render';

const chatHistory = ref([{ id: 2, sender: 'assistant', text: 'Hi there! How can I assist you?' }]);
const inputText = ref('');
const thinking = ref(false);
const route = useRoute();
const toast = useToast();
const repoId = route.params.repo_id;

const { data: repo } = await useFetch(`/api/repos/${repoId}`);

function makeId(length: number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}
const chatId = makeId(10);

async function askQuestion(message: string) {
  inputText.value = message;
  await sendMessage();
}

async function sendMessage() {
  if (thinking.value) {
    return;
  }

  const message = inputText.value;
  if (message === '') {
    return;
  }

  chatHistory.value.push({
    id: Date.now(),
    sender: 'user',
    text: message,
  });
  inputText.value = '';

  thinking.value = true;

  try {
    const res = await $fetch(`/api/repos/${repoId}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        chat_id: chatId,
      }),
    });

    if (res.answer) {
      chatHistory.value.push({
        id: Date.now(),
        sender: 'assistant',
        text: res.answer,
      });
    }
  } catch (e) {
    const error = e as Error;
    chatHistory.value.push({
      id: Date.now(),
      sender: 'error',
      text: error.message,
    });
  }

  thinking.value = false;
}

const loading = ref(false);
async function reIndex() {
  loading.value = true;
  try {
    await $fetch(`/api/repos/${repoId}/clone`, {
      method: 'POST',
    });
    toast.add({
      title: 'Success',
      description: 'Repo synced successfully',
      color: 'green',
    });
  } catch (e) {
    const error = e as Error;
    toast.add({
      title: 'Error',
      description: error.message,
      color: 'red',
    });
  }
  loading.value = false;
}

watch(
  repo,
  async () => {
    if (repo.value && !repo.value.lastFetch) {
      await reIndex();
    }
  },
  {
    immediate: true,
  },
);
</script>

<style scoped>
.fab-btn {
  transition: box-shadow 0.4s ease;
}

input:checked + .fab-btn span {
  transform: rotate(360deg);
}
</style>
