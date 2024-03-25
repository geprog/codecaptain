import { forgeSchema } from '~/server/schemas';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const forgeData = await readBody(event);

  const forge = await db
    .insert(forgeSchema)
    .values({ ...forgeData, allowLogin: false, owner: user.id }) // TODO: allow admins to allow login via their forges
    .returning()
    .get();

  return forge;
});
