import { forgeSchema } from '~/server/schemas';

export default defineEventHandler(async (event) => {
  const forges = await db.select().from(forgeSchema).all();

  // use map to hide client id and secret
  return forges.map((forge) => ({
    id: forge.id,
    owner: forge.owner,
    host: forge.host,
    type: forge.type,
    allowLogin: forge.allowLogin,
  }));
});
