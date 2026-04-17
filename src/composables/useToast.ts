import { reactive } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

// Singleton state — shared across all component instances
const state = reactive<{ toasts: Toast[] }>({ toasts: [] });
let _nextId = 0;

export function useToast() {
  const push = (message: string, type: ToastType, duration = 4500) => {
    const id = _nextId++;
    state.toasts.push({ id, type, message });
    setTimeout(() => remove(id), duration);
  };

  const remove = (id: number) => {
    const i = state.toasts.findIndex(t => t.id === id);
    if (i !== -1) state.toasts.splice(i, 1);
  };

  return {
    toasts:  state.toasts,
    remove,
    success: (m: string) => push(m, 'success'),
    error:   (m: string) => push(m, 'error', 6500),
    warning: (m: string) => push(m, 'warning'),
    info:    (m: string) => push(m, 'info'),
  };
}
