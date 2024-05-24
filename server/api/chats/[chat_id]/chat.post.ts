import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory } from 'langchain/memory';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { formatDocumentsAsString } from 'langchain/util/document';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { chatMessageSchema, chatSchema, repoSchema } from '~/server/schemas';
import { and, eq } from 'drizzle-orm';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { HumanMessage, SystemMessage } from 'langchain/schema';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const chatId = getRouterParam(event, 'chat_id');
  if (!chatId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'chat_id is required',
    });
  }

  const chat = await db
    .select()
    .from(chatSchema)
    .where(and(eq(chatSchema.id, parseInt(chatId, 10)), eq(chatSchema.userId, user.id)))
    .get();

  if (!chat) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Chat not found',
    });
  }

  const body = await readBody<{
    message: string;
  }>(event);
  const message = body?.message;
  if (!message) {
    throw createError({
      statusCode: 400,
      statusMessage: 'message and chat_id are required',
    });
  }

  const repo = await db.select().from(repoSchema).where(eq(repoSchema.id, chat.repoId)).get();
  if (!repo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Repo not found',
    });
  }

  const config = useRuntimeConfig();

  const model = new ChatOpenAI({ modelName: config.ai.model, openAIApiKey: config.ai.token }).pipe(
    new StringOutputParser(),
  );

  const vectorStore = await getRepoVectorStore(repo.id);

  const retriever = vectorStore.asRetriever({
    searchType: 'mmr', // Use max marginal relevance search
    searchKwargs: { fetchK: 5 },
  });

  const memory = new BufferMemory({
    returnMessages: true, // Return stored messages as instances of `BaseMessage`
    memoryKey: 'chat_history', // This must match up with our prompt template input variable.
  });

  const messages = await db.select().from(chatMessageSchema).where(eq(chatMessageSchema.chatId, chat.id)).all();
  for (const message of messages) {
    if (message.from === 'user') {
      await memory.chatHistory.addAIChatMessage(message.content);
    } else if (message.from === 'ai') {
      await memory.chatHistory.addUserMessage(message.content);
    }
  }

  const questionGeneratorTemplate = ChatPromptTemplate.fromMessages([
    AIMessagePromptTemplate.fromTemplate(
      'Given the following conversation about a codebase and a follow up question, rephrase the follow up question to be a standalone question.',
    ),
    new MessagesPlaceholder('chat_history'),
    AIMessagePromptTemplate.fromTemplate(`Follow Up Input: {question}
  Standalone question:`),
  ]);

  const combineDocumentsPrompt = ChatPromptTemplate.fromMessages([
    AIMessagePromptTemplate.fromTemplate(
      "Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n{context}\n\n",
    ),
    new MessagesPlaceholder('chat_history'),
    HumanMessagePromptTemplate.fromTemplate('Question: {question}'),
  ]);

  const combineDocumentsChain = RunnableSequence.from([
    {
      question: (output: string) => output,
      chat_history: async () => {
        const { chat_history } = await memory.loadMemoryVariables({});
        return chat_history;
      },
      context: async (output: string) => {
        const relevantDocs = await retriever.getRelevantDocuments(output);
        return formatDocumentsAsString(relevantDocs);
      },
    },
    combineDocumentsPrompt,
    model,
    new StringOutputParser(),
  ]);

  const conversationalQaChain = RunnableSequence.from([
    {
      question: (i: { question: string }) => i.question,
      chat_history: async () => {
        const { chat_history } = await memory.loadMemoryVariables({});
        return chat_history;
      },
    },
    questionGeneratorTemplate,
    model,
    new StringOutputParser(),
    combineDocumentsChain,
  ]);

  const result = await conversationalQaChain.invoke({
    question: message,
  });

  // summarize the dialog when we got the second question from the user
  if (messages.length >= 2 && chat.name.startsWith('Chat with')) {
    const context = [
      'Provide keywords or a short summary with maximal six words for the following dialog:\n',
      ...messages.map((m) => `${m.from}: ${m.content}`),
      `user: ${message}`,
      `ai: ${result}`,
    ];
    const chatSummary = await model.invoke(context.join('\n'));
    await db.update(chatSchema).set({ name: chatSummary }).where(eq(chatSchema.id, chat.id)).run();
  }

  await db
    .insert(chatMessageSchema)
    .values([
      {
        chatId: chat.id,
        from: 'user',
        content: message,
        createdAt: new Date(),
      },
      {
        chatId: chat.id,
        from: 'ai',
        content: result,
        createdAt: new Date(),
      },
    ])
    .run();

  return { answer: result };
});
