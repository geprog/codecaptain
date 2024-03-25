export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated } = await useAuth();

  if (!isAuthenticated.value && to.path !== '/auth/login') {
    return navigateTo('/auth/login');
  }

  if (isAuthenticated.value && to.path === '/auth/login') {
    return navigateTo('/');
  }
});
