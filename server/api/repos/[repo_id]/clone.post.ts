import path from 'node:path';
import { simpleGit } from 'simple-git';
import { repoSchema } from '~/server/schemas';
import { eq } from 'drizzle-orm';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import weaviate from 'weaviate-ts-client';
import { WeaviateStore } from '@langchain/weaviate';
import { Document } from 'langchain/document';
import { Glob } from 'glob';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const _repoId = event.context.params?.repo_id;
  if (!_repoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'repo_id is required',
    });
  }
  const repoId = parseInt(_repoId, 10);

  const repo = await requireAccessToRepo(user, repoId);

  const config = useRuntimeConfig();
  const folder = path.join(config.data_path, repo.id.toString());
  const repoPath = path.join(folder, 'repo');

  const stream = new ReadableStream({
    async start(controller) {
      const log = (...d: unknown[]) => {
        console.log(...d);
        controller.enqueue(...d.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))));
      };

      try {
        await createDataFolder();

        const userForgeApi = await getUserForgeAPI(user, repo.forgeId);

        const forgeRepo = await userForgeApi.getRepo(repo.remoteId.toString());

        await db
          .update(repoSchema)
          .set({
            name: forgeRepo.name,
            url: forgeRepo.url,
            cloneUrl: forgeRepo.cloneUrl,
            defaultBranch: forgeRepo.defaultBranch,
            avatarUrl: forgeRepo.avatarUrl,
          })
          .where(eq(repoSchema.id, repo.id))
          .run();

        const cloneCredentials = await userForgeApi.getCloneCredentials();
        const cloneUrl = repo.cloneUrl.replace(
          'https://',
          `https://${cloneCredentials.username}:${cloneCredentials.password}@`,
        );

        const e = await dirExists(repoPath);
        console.log({ cloneUrl, repoPath, dir: e, c: config.data_path });

        if (!e) {
          log('cloning repo ...');
          let cloneLogs = await simpleGit().clone(cloneUrl, repoPath);
          log('cloned repo', cloneLogs);
        } else {
          log('pulling changes ...');
          await simpleGit(repoPath).removeRemote('origin');
          await simpleGit(repoPath).addRemote('origin', cloneUrl);
          await simpleGit(repoPath).pull('origin', repo.defaultBranch);
          log('pulled latest changes');
        }

        log('indexing ...');

        const docs: Document[] = [];

        // index issues
        let page = 1;
        const perPage = 50;
        const since = repo.lastFetch || undefined;
        log('fetching issues since', since, '...');
        while (true) {
          const { items: issues, total } = await userForgeApi.getIssues(repo.remoteId.toString(), {
            page,
            perPage,
            since,
          });
          for await (const issue of issues) {
            let issueString = `# issue "${issue.title}" (${issue.number})`;
            if (issue.labels.length !== 0) {
              issueString += `\n\nLabels: ` + issue.labels.join(', ');
            }
            if (issue.description !== '') {
              issueString += `\n\n${issue.description}`;
            }
            if (issue.comments.length !== 0) {
              issueString +=
                `\n\n## Comments:\n` +
                issue.comments.map((comment) => `- ${comment.author.login}: ${comment.body}`).join('\n');
            }
            const doc = new Document({
              pageContent: issueString,
              metadata: { issueId: issue.number, type: 'issue' },
            });
            docs.push(doc);
          }

          if (issues.length < perPage || page * perPage >= total) {
            break;
          }
          page += 1;
        }

        log(`indexed ${page * perPage} issues`);

        const javascriptSplitter = RecursiveCharacterTextSplitter.fromLanguage('js', {
          chunkSize: 2000,
          chunkOverlap: 200,
        });

        // extensions of source code files to index
        const includeExtensions = [
          'js',
          'jsx',
          'ts',
          'tsx',
          'json',
          'md',
          'html',
          'yaml',
          'yml',
          'go',
          'txt',
          'sh',
          'java',
          'py',
          'rb',
          'php',
          'c',
          'cpp',
          'h',
          'hpp',
          'cs',
          'swift',
          'kt',
          'kts',
          'ktm',
          'rs',
          'vue',
          'svelte',
          'graphql',
          'gql',
          'gradle',
          'bat',
          'properties',
          'lua',
          // 'css',
          // 'scss',
          // 'less',
          // 'sass',
        ];

        // ignore these directories and files
        const ignore = [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/coverage/**',
          '**/tmp/**',
          '**/temp/**',
          '**/vendor/**',
          '**/out/**',
          '**/target/**',
          '**/lib/**',
          '**/dll/**',
          '**/bin/**',
          'pnpm-lock.yaml',
          'package-lock.json',
        ];
        const glob = new Glob(`**/*.{${includeExtensions.join(',')}}`, {
          cwd: repoPath,
          nocase: true,
          ignore,
        });
        for await (const file of glob) {
          const loader = new TextLoader(path.join(repoPath, file));
          const fileDocs = await loader.load();
          docs.push(
            ...fileDocs.map((d) => {
              d.metadata.source = file;
              return d;
            }),
          );

          console.log('indexing', file);

          // switch (path.extname(file)) {
          //   case '.js':
          //   case '.ts':
          //   case '.jsx':
          //   case '.tsx':
          //     const texts = await javascriptSplitter.splitDocuments(fileDocs);
          //     docs.push(...texts);
          //     break;
          //   default:
          //     docs.push(...fileDocs);
          //     break;
          // }
        }

        console.log({ docs: docs.length });

        const weaviateClient = weaviate.client({
          scheme: process.env.WEAVIATE_SCHEME || 'http',
          host: process.env.WEAVIATE_HOST || 'localhost:8080',
          // apiKey: new ApiKey(process.env.WEAVIATE_API_KEY || 'default'),
        });

        await WeaviateStore.fromDocuments(
          docs,
          new OpenAIEmbeddings({
            openAIApiKey: config.ai.token,
          }),
          {
            client: weaviateClient,
            indexName: `Repo${repoId}`,
          },
        );

        await db
          .update(repoSchema)
          .set({
            lastFetch: new Date(),
          })
          .where(eq(repoSchema.id, repo.id))
          .run();

        log('done indexing');
      } catch (e) {
        log('error', e);
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });

  setResponseHeader(event, 'Content-Type', 'text/html');
  setResponseHeader(event, 'Cache-Control', 'no-cache');
  setResponseHeader(event, 'Transfer-Encoding', 'chunked');

  return sendStream(event, stream);
});
