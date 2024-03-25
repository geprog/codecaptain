import { forgeSchema } from '~/server/schemas';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const _forgeId = event.context.params?.forge_id;
  if (!_forgeId) {
    throw createError({
      message: 'Cannot create forge with a forge_id',
      status: 400,
    });
  }
  const forgeId = parseInt(_forgeId, 10);

  const forge = await db
    .select()
    .from(forgeSchema)
    .where(and(eq(forgeSchema.owner, user.id), eq(forgeSchema.id, forgeId)))
    .get();

  return forge;
});
