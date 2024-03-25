import { repoSchema, userReposSchema } from '~/server/schemas';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const repos = await db
    .select()
    .from(repoSchema)
    .innerJoin(userReposSchema, eq(repoSchema.id, userReposSchema.repoId))
    .where(eq(userReposSchema.userId, user.id))
    .all();

  return repos.flatMap((r) => r.repos);
});
