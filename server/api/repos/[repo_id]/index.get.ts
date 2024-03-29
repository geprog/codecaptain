export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const repoId = event.context.params?.repo_id;
  if (!repoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'repo_id is required',
    });
  }

  const repo = await requireAccessToRepo(user, parseInt(repoId, 10));
  return repo;
});
