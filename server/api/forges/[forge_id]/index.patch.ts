import { forgeSchema } from '~/server/schemas';
import { eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const forgeData = await readBody(event);

  const _forgeId = event.context.params?.forge_id;
  if (!_forgeId) {
    throw createError({
      message: 'Cannot create forge with a forge_id',
      status: 400,
    });
  }
  const forgeId = parseInt(_forgeId, 10);

  const forge = await db
    .update(forgeSchema)
    .set({ clientId: forgeData.clientId, clientSecret: forgeData.clientSecret })
    .where(and(eq(forgeSchema.owner, user.id), eq(forgeSchema.id, forgeId)))
    .returning()
    .get();

  return forge;
});
