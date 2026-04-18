import { reactive } from 'vue';
import { supabase } from '../supabase';

type Notification = {
  id: string;
  tipo: 'ticket' | 'alerta';
  titulo: string;
  subtitulo: string;
  leida: boolean;
  ts: number;
};

export const notifStore = reactive({
  items:   [] as Notification[],
  unread:  0,
  active:  false,
});

let channel: ReturnType<typeof supabase.channel> | null = null;

export function initRealtime() {
  if (notifStore.active) return;
  notifStore.active = true;

  channel = supabase
    .channel('realtime-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tickets' },
      (payload) => {
        const t = payload.new as any;
        addNotif({
          tipo:      'ticket',
          titulo:    t.asunto ?? 'Nuevo ticket',
          subtitulo: `Prioridad: ${t.prioridad ?? '—'}`,
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'facturas' },
      (payload) => {
        const f = payload.new as any;
        if (f.estado === 'Vencida') {
          addNotif({
            tipo:      'alerta',
            titulo:    'Factura vencida',
            subtitulo: f.concepto ?? '',
          });
        }
      }
    )
    .subscribe();
}

export function stopRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  notifStore.active = false;
}

export function marcarTodasLeidas() {
  notifStore.items.forEach(n => { n.leida = true; });
  notifStore.unread = 0;
}

function addNotif(n: Omit<Notification, 'id' | 'leida' | 'ts'>) {
  const notif: Notification = {
    ...n,
    id:    crypto.randomUUID(),
    leida: false,
    ts:    Date.now(),
  };
  notifStore.items.unshift(notif);
  if (notifStore.items.length > 20) notifStore.items.pop();
  notifStore.unread = notifStore.items.filter(x => !x.leida).length;
}
