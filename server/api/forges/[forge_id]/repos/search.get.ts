import { repoSchema, userReposSchema } from '~/server/schemas';
import { and, eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const forgeId = event.context.params?.forge_id;
  if (!forgeId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'forgeId is required',
    });
  }

  const forge = await getUserForgeAPI(user, parseInt(forgeId, 10));

  const query = getQuery<{ search?: string }>(event);
  const search = query?.search?.trim() || '';

  // TODO: use caching along with the db query
  const activeRepos = (
    await db
      .select()
      .from(repoSchema)
      .innerJoin(userReposSchema, eq(repoSchema.id, userReposSchema.repoId))
      .where(and(eq(repoSchema.forgeId, Number(forgeId)), eq(userReposSchema.userId, user.id)))
      .all()
  ).map((r) => r.repos);

  console.log('activeRepos', activeRepos);

  const forgeRepos = await forge.getRepos(search);

  return forgeRepos.items.map((repo) => {
    const internalRepo = activeRepos.find((r) => r.remoteId === repo.id.toString());
    return {
      remoteId: repo.id.toString(),
      internalId: internalRepo?.id,
      name: repo.name,
      avatarUrl: repo.avatarUrl,
    };
  });
});
