export async function useRepositoriesStore() {
  const { data: repos, refresh } = await useFetch('/api/repos', {
    default: () => [],
  });

  return { repos, refresh };
}
