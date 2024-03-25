import { eq, or, inArray } from 'drizzle-orm';
import { forgeSchema, userForgesSchema } from '~/server/schemas';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const userForges = await db.select().from(userForgesSchema).where(eq(userForgesSchema.userId, user.id)).all();
  const forges = await db.select().from(forgeSchema).all();

  return forges.map((forge) => {
    const isConnected = userForges.some((userForge) => userForge.forgeId === forge.id);
    return { ...forge, isConnected };
  });
});
