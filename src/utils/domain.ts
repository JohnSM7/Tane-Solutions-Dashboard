const host = window.location.hostname;

export const isClientDomain = (): boolean =>
  host.includes('clientes') || host.includes('client');

export const isAdminDomain = (): boolean => !isClientDomain();

export const loginRoute = (): string =>
  isClientDomain() ? '/login-cliente' : '/login';
