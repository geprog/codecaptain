export async function useForgesStore() {
  const { data: forges, refresh } = await useFetch('/api/user/forges', {
    default: () => [],
  });

  return { forges, refresh };
}
