import { OpenAIEmbeddings } from '@langchain/openai';
import weaviate from 'weaviate-ts-client';
import { WeaviateStore } from '@langchain/weaviate';
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

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const repoId = getRouterParam(event, 'repo_id');
  if (!repoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'repo_id is required',
    });
  }

  const repo = await requireAccessToRepo(user, parseInt(repoId, 10));

  const body = await readBody<{
    message: string;
    chat_id: string;
  }>(event);
  const message = body?.message;
  const chatId = body?.chat_id;
  if (!message || !chatId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'message and chat_id are required',
    });
  }

  const config = useRuntimeConfig();

  const model = new ChatOpenAI({ modelName: 'gpt-4', openAIApiKey: config.ai.token }).pipe(new StringOutputParser());

  const weaviateClient = weaviate.client({
    scheme: process.env.WEAVIATE_SCHEME || 'http',
    host: process.env.WEAVIATE_HOST || 'localhost:8080',
    // apiKey: new ApiKey(process.env.WEAVIATE_API_KEY || 'default'),
  });

  const vectorStore = await WeaviateStore.fromExistingIndex(new OpenAIEmbeddings(), {
    client: weaviateClient,
    indexName: `Repo${repo.id}`,
  });

  const retriever = vectorStore.asRetriever({
    searchType: 'mmr', // Use max marginal relevance search
    searchKwargs: { fetchK: 5 },
  });

  const memory = new BufferMemory({
    returnMessages: true, // Return stored messages as instances of `BaseMessage`
    memoryKey: 'chat_history', // This must match up with our prompt template input variable.
  });

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

  await memory.saveContext(
    {
      input: message,
    },
    {
      output: result,
    },
  );

  return { answer: result };
});
