import { repoSchema, userReposSchema } from '../../../../schemas';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const forgeIdFromParams = event.context.params?.forge_id;
  if (!forgeIdFromParams) {
    throw createError({
      statusCode: 400,
      statusMessage: 'repo_id is required',
    });
  }

  const forgeId = parseInt(forgeIdFromParams, 10);
  const forge = await getUserForgeAPI(user, forgeId);

  const { remoteRepoId } = (await readBody(event)) as { remoteRepoId?: string };
  if (!remoteRepoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'remoteRepoId is required',
    });
  }

  const forgeRepo = await forge.getRepo(remoteRepoId);

  const repo = await db
    .insert(repoSchema)
    .values({
      name: forgeRepo.name,
      cloneUrl: forgeRepo.cloneUrl,
      remoteId: forgeRepo.id.toString(),
      url: forgeRepo.url,
      forgeId: forgeRepo.forgeId,
    })
    .onConflictDoUpdate({
      target: [repoSchema.forgeId, repoSchema.remoteId],
      set: {
        name: forgeRepo.name,
        cloneUrl: forgeRepo.cloneUrl,
        url: forgeRepo.url,
      },
    })
    .returning()
    .get();

  await db
    .insert(userReposSchema)
    .values({
      userId: user.id,
      repoId: repo.id,
    })
    .run();

  return repo;
});
