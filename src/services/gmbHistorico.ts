import { ref } from 'vue';
import { supabase } from '../supabase';
import type { Sede } from './clients';

export type GmbSnapshot = {
  id: number;
  sede_id: number;
  cliente_id: string;
  fecha: string;
  gmb_rating: number;
  gmb_reviews: number;
  gmb_unanswered: number;
  gmb_pub_views: number;
};

export function useGmbHistorico(clienteId: string) {
  const snapshots = ref<GmbSnapshot[]>([]);
  const loading   = ref(true);

  const fetch = async () => {
    try {
      const { data } = await supabase
        .from('gmb_snapshots')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('fecha', { ascending: true })
        .limit(90);
      snapshots.value = (data ?? []) as GmbSnapshot[];
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  fetch();
  return { snapshots, loading, refresh: fetch };
}

export async function tomarSnapshot(sedes: Sede[], clienteId: string): Promise<void> {
  const hoy = new Date().toISOString().split('T')[0];
  const rows = sedes.map(s => ({
    sede_id:        s.id,
    cliente_id:     clienteId,
    fecha:          hoy,
    gmb_rating:     s.gmb_rating,
    gmb_reviews:    s.gmb_reviews,
    gmb_unanswered: s.gmb_unanswered,
    gmb_pub_views:  s.gmb_pub_views,
  }));

  const { error } = await supabase
    .from('gmb_snapshots')
    .upsert(rows, { onConflict: 'sede_id,fecha' });

  if (error) throw error;
}
