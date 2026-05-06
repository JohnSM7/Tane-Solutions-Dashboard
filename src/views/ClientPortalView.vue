<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import ClientReportModule from '../components/ClientReportModule.vue';
import { authStore } from '../store/auth';
import { useClientProfile } from '../services/clients';
import { ESTADO_COLORS } from '../services/operations';
import { generateInvoicePDF, type Factura } from '../services/financial';
import { createTicket, updateTicket, useClientTickets } from '../services/support';
import { supabase } from '../supabase';
import { useToast } from '../composables/useToast';

const clientId = authStore.user?.clientId ?? '';
const {
  clientData, proyectos, sedes, documentos, facturas,
  loading,
  uploadDocumento, saveProfile,
} = useClientProfile(clientId);

const toast = useToast();

const { tickets: misTickets, reload: reloadTickets } = useClientTickets(clientId);

const PROGRESO_ESTADO: Record<string, number> = {
  'Planificado': 5, 'En curso': 50, 'En riesgo': 40,
  'Retrasado': 30, 'Bloqueado': 20, 'Completado': 100,
};
const progresoProyecto = (estado: string) => PROGRESO_ESTADO[estado] ?? 50;

const TICKET_COLOR: Record<string, string> = {
  'Abierto': '#ffa500', 'En proceso': '#e3ff04', 'Cerrado': '#4ade80',
};

const selectedSedeId = ref<number | 'all'>('all');

const filteredProyectos = computed(() => {
  if (selectedSedeId.value === 'all') return proyectos.value;
  return proyectos.value.filter((p: any) => p.sede_id === selectedSedeId.value);
});

const filteredDocumentos = computed(() => {
  if (selectedSedeId.value === 'all') return documentos.value;
  return documentos.value.filter((d: any) => d.sede_id === selectedSedeId.value);
});

const filteredSedes = computed(() => {
  if (selectedSedeId.value === 'all') return sedes.value;
  return sedes.value.filter(s => s.id === selectedSedeId.value);
});

// ── Facturas agrupadas por proyecto ──────────────────────────────────────────
const facturasAgrupadas = computed(() => {
  const grupos = new Map<string, { nombre: string; facturas: Factura[] }>();
  for (const f of facturas.value) {
    const key = f.proyecto_id ?? '__sin_proyecto__';
    const nombre = (f as any).proyectos_rentabilidad?.nombre ?? (f.proyecto_id ? 'Proyecto' : 'Otras facturas');
    if (!grupos.has(key)) grupos.set(key, { nombre, facturas: [] });
    grupos.get(key)!.facturas.push(f);
  }
  return [...grupos.values()];
});

// ── Banner de estado ──────────────────────────────────────────────────────────
const statusBanner = computed(() => {
  if (loading.value || !clientData.value) return null;
  const tieneVencidas  = facturas.value.some((f: Factura) => f.estado === 'Vencida');
  const tienePendientes = facturas.value.some((f: Factura) => f.estado === 'Pendiente');
  if (tieneVencidas)   return { level: 'danger',  icon: '⚠️', msg: 'Tienes facturas vencidas. Por favor, contacta con nosotros para regularizar el pago.' };
  if (tienePendientes) return { level: 'warning', icon: '💳', msg: 'Tienes facturas pendientes de pago. Consúltalas en tu resumen financiero.' };
  return { level: 'success', icon: '✅', msg: 'Todo al día. No hay ninguna acción pendiente por tu parte.' };
});

// ── Descargar factura PDF ─────────────────────────────────────────────────────
const downloadingInvoice = ref<string | null>(null);

const downloadInvoicePdf = async (f: Factura) => {
  downloadingInvoice.value = f.id;
  try {
    await generateInvoicePDF(
      f,
      clientData.value
        ? { nombre: clientData.value.name, cif: clientData.value.cif, direccion_facturacion: clientData.value.direccionFacturacion }
        : null,
      f.proyectos_rentabilidad?.nombre ?? '',
    );
    toast.success(`Factura ${f.numero_factura ?? ''} descargada`);
  } catch {
    toast.error('No se pudo generar el PDF. Inténtalo de nuevo.');
  } finally {
    downloadingInvoice.value = null;
  }
};

// ── Abrir ticket de soporte ───────────────────────────────────────────────────
const showTicketModal = ref(false);
const savingTicket   = ref(false);
const ticketForm     = ref({ asunto: '', descripcion: '', prioridad: 'Media' as 'Alta' | 'Media' | 'Baja' });

const openTicketModal = () => {
  ticketForm.value = { asunto: '', descripcion: '', prioridad: 'Media' };
  showTicketModal.value = true;
};

const submitTicket = async () => {
  if (!ticketForm.value.asunto.trim()) return;
  savingTicket.value = true;
  try {
    await createTicket({
      asunto:      ticketForm.value.asunto.trim(),
      descripcion: ticketForm.value.descripcion.trim(),
      cliente_id:  clientId,
      prioridad:   ticketForm.value.prioridad,
      estado:      'Abierto',
    });
    showTicketModal.value = false;
    await reloadTickets();
    toast.success('Tu solicitud de soporte ha sido enviada. Te responderemos pronto.');
  } catch {
    toast.error('No se pudo enviar la solicitud. Inténtalo de nuevo.');
  } finally {
    savingTicket.value = false;
  }
};

// ── Valorar ticket cerrado ────────────────────────────────────────────────────
const setSatisfaccion = async (ticketId: number, stars: number) => {
  try {
    const updated = await updateTicket(ticketId, { satisfaccion: stars });
    const idx = misTickets.value.findIndex(t => t.id === ticketId);
    if (idx !== -1) misTickets.value[idx] = { ...misTickets.value[idx], ...updated };
    toast.success('Gracias por tu valoración');
  } catch {
    toast.error('No se pudo guardar la valoración');
  }
};

// ── Editar perfil ─────────────────────────────────────────────────────────────
const showEditModal = ref(false);
const savingProfile = ref(false);
const editForm = ref({ name: '', contact: '', logo: '' });

const openEditModal = () => {
  if (!clientData.value) return;
  editForm.value = { name: clientData.value.name, contact: clientData.value.contact, logo: clientData.value.logo };
  showEditModal.value = true;
};
const handleSaveProfile = async () => {
  savingProfile.value = true;
  await saveProfile(editForm.value);
  savingProfile.value = false;
  showEditModal.value = false;
};

// ── Download documentos ───────────────────────────────────────────────────────
const downloadDoc = async (url: string, nombre: string) => {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── Upload documentos ─────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref('');

const triggerUpload = () => fileInput.value?.click();

const handleFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  uploadError.value = '';
  try {
    const sedeId = selectedSedeId.value !== 'all' ? (selectedSedeId.value as number) : null;
    await uploadDocumento(file, sedeId, 'Cliente');
  } catch (err: any) {
    uploadError.value = err.message ?? 'Error al subir';
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
};

// ── Links compartidos ─────────────────────────────────────────────────────────
type LinkCliente = { id: string; titulo: string; url: string; descripcion: string | null };
const links = ref<LinkCliente[]>([]);
supabase.from('links_cliente').select('*').eq('cliente_id', clientId).order('created_at', { ascending: false })
  .then(({ data }) => { links.value = (data ?? []) as LinkCliente[]; });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });


</script>

<template>
  <div class="view-container">
    <div v-if="!clientId" class="loading-state" style="text-align:center;padding:3rem;">
      <h2 style="color:#ffa500;margin-bottom:1rem;">⚠️ Tu usuario no tiene cliente asignado</h2>
      <p style="color:var(--color-text-muted);">Tu cuenta aún no está vinculada a ningún cliente.<br/>Contacta con la agencia en <a href="mailto:info@tanesolutions.com" style="color:var(--color-primary);">info@tanesolutions.com</a> para resolverlo.</p>
    </div>
    <div v-else-if="loading" class="loading-state">Cargando tu panel...</div>

    <template v-else-if="clientData">
      <!-- Cabecera de bienvenida -->
      <div class="welcome-header">
        <div class="welcome-text">
          <h1>Hola, {{ clientData.contact.split(' ')[0] }} 👋</h1>
          <p>Panel central de <strong>{{ clientData.name }}</strong>. Revisa el progreso de tus proyectos, métricas y documentos.</p>
          <div class="location-filter">
            <label>📍 Filtrar por Sede:</label>
            <select v-model="selectedSedeId" class="custom-select">
              <option value="all">Ver todas</option>
              <option v-for="s in sedes" :key="s.id" :value="s.id">{{ s.nombre }}</option>
            </select>
          </div>
        </div>
        <div class="client-brand">
          <img v-if="clientData.logo" :src="clientData.logo" :alt="clientData.name" class="client-logo" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
          <div v-else class="logo-placeholder">{{ clientData.name.charAt(0) }}</div>
          <span class="brand-name">{{ clientData.name }}</span>
          <button class="btn-sm btn-soporte" @click="openTicketModal">✉ Soporte</button>
          <button class="btn-sm btn-outline" @click="openEditModal">Editar Perfil</button>
        </div>
      </div>

      <!-- Banner de estado -->
      <div v-if="statusBanner" class="status-banner" :class="statusBanner.level">
        <span class="status-banner-icon">{{ statusBanner.icon }}</span>
        <span class="status-banner-msg">{{ statusBanner.msg }}</span>
        <button v-if="statusBanner.level !== 'success'" class="btn-soporte-banner" @click="openTicketModal">
          Contactar soporte
        </button>
      </div>

      <!-- Facturas por proyecto -->
      <DashboardCard v-if="facturasAgrupadas.length > 0" title="Facturas">
        <div class="facturas-grupos">
          <div v-for="grupo in facturasAgrupadas" :key="grupo.nombre" class="facturas-grupo">
            <p class="facturas-grupo-titulo">{{ grupo.nombre }}</p>
            <div v-for="f in grupo.facturas" :key="f.id" class="factura-row-cliente">
              <div class="factura-info">
                <span class="factura-num">{{ f.numero_factura ?? 'Borrador' }}</span>
                <span class="factura-concepto">{{ f.concepto }}</span>
              </div>
              <div class="factura-right-cliente">
                <span class="factura-estado-badge" :class="f.estado.toLowerCase()">{{ f.estado }}</span>
                <button
                  class="btn-pdf-cliente"
                  :disabled="downloadingInvoice === f.id"
                  @click="downloadInvoicePdf(f)"
                  title="Descargar PDF"
                >{{ downloadingInvoice === f.id ? '⏳' : '⬇ PDF' }}</button>
              </div>
            </div>
          </div>
        </div>
      </DashboardCard>

      <div class="content-grid">
        <!-- Proyectos -->
        <DashboardCard title="Proyectos en Curso">
          <div v-if="filteredProyectos.length === 0" class="empty-state">Sin proyectos activos para esta sede</div>
          <ul v-else class="activity-list">
            <li v-for="p in filteredProyectos" :key="p.id" class="proyecto-item">
              <div class="act-dot" :style="{ backgroundColor: ESTADO_COLORS[p.estado] }"></div>
              <div class="act-text">
                <strong>{{ p.nombre }}</strong>
                <span>{{ p.fase || p.estado }}</span>
                <div class="progress-bar-wrap">
                  <div class="progress-bar-fill"
                    :style="{ width: progresoProyecto(p.estado) + '%', background: ESTADO_COLORS[p.estado] }">
                  </div>
                </div>
              </div>
              <span class="progress-pct">{{ progresoProyecto(p.estado) }}%</span>
            </li>
          </ul>
        </DashboardCard>

        <!-- Documentos -->
        <DashboardCard title="Mis Documentos">
          <div class="upload-area" @click="triggerUpload" :class="{ uploading }">
            <input ref="fileInput" type="file" class="hidden-input" @change="handleFileChange" />
            <div class="upload-icon">{{ uploading ? '⏳' : '⬆️' }}</div>
            <p>{{ uploading ? 'Subiendo archivo...' : 'Haz clic para enviar un archivo a la agencia' }}</p>
            <span class="upload-hint">Fotos, PDF, documentos — máx. 50 MB</span>
          </div>
          <p v-if="uploadError" class="error-msg">{{ uploadError }}</p>

          <div v-if="filteredDocumentos.length === 0" class="empty-state">Sin documentos</div>
          <ul v-else class="docs-list">
            <li v-for="doc in filteredDocumentos" :key="doc.id" class="doc-item">
              <div class="doc-info">
                <span class="doc-icon">📄</span>
                <div class="doc-meta">
                  <span class="doc-name">{{ doc.nombre }}</span>
                  <span class="doc-details">
                    {{ formatDate(doc.creado_en) }} ·
                    <strong :class="{ 'text-primary': doc.subido_por === 'Agencia' }">{{ doc.subido_por }}</strong>
                  </span>
                </div>
              </div>
              <button class="btn-view" @click="downloadDoc(doc.url, doc.nombre)">⬇️ Descargar</button>
            </li>
          </ul>
        </DashboardCard>
      </div>

      <!-- Links compartidos -->
      <DashboardCard v-if="links.length > 0" title="Links Compartidos">
        <ul class="links-list">
          <li v-for="l in links" :key="l.id" class="link-item">
            <span class="link-icon">🔗</span>
            <div class="link-meta">
              <span class="link-titulo">{{ l.titulo }}</span>
              <span v-if="l.descripcion" class="link-desc">{{ l.descripcion }}</span>
            </div>
            <a :href="l.url" target="_blank" rel="noopener" class="btn-view">Abrir ↗</a>
          </li>
        </ul>
      </DashboardCard>

      <!-- Módulo de Informes de Trabajo -->
      <ClientReportModule
        :client-id="clientId"
        :client-data="clientData ? { name: clientData.name, contact: clientData.contact, industry: clientData.industry } : null"
        :proyectos="proyectos"
        :is-admin="false"
      />

      <!-- Mis Tickets de Soporte -->
      <DashboardCard title="Mis Solicitudes de Soporte">
        <template #actions>
          <button class="btn-sm btn-soporte" @click="openTicketModal">+ Nueva solicitud</button>
        </template>
        <div v-if="misTickets.length === 0" class="empty-state-small">No tienes solicitudes de soporte abiertas.</div>
        <ul v-else class="tickets-list">
          <li v-for="t in misTickets" :key="t.id" class="ticket-row" :class="{ 'ticket-closed': t.estado === 'Cerrado' }">
            <div class="ticket-info">
              <span class="ticket-asunto">{{ t.asunto }}</span>
              <span class="ticket-fecha">{{ formatDate(t.fecha_creacion) }}</span>
            </div>
            <span class="ticket-badge" :style="{ color: TICKET_COLOR[t.estado], borderColor: TICKET_COLOR[t.estado] + '55' }">
              {{ t.estado }}
            </span>
            <!-- Respuesta del equipo al cerrar -->
            <div v-if="t.estado === 'Cerrado' && t.respuesta_cierre" class="ticket-resolucion">
              <span class="ticket-resolucion-label">Resolución:</span>
              {{ t.respuesta_cierre }}
            </div>
            <!-- Valoración del cliente -->
            <div v-if="t.estado === 'Cerrado'" class="ticket-rating">
              <span class="ticket-rating-label">{{ t.satisfaccion ? 'Tu valoración:' : 'Valora la atención:' }}</span>
              <span
                v-for="star in 5"
                :key="star"
                class="star"
                :class="{ active: star <= (t.satisfaccion ?? 0), readonly: !!t.satisfaccion }"
                @click="!t.satisfaccion && setSatisfaccion(t.id, star)"
              >★</span>
            </div>
          </li>
        </ul>
      </DashboardCard>

      <!-- Google My Business -->
      <div v-if="filteredSedes.length > 0">
        <h3 class="section-title">Fichas de Google My Business</h3>
        <div class="gmb-grid">
          <DashboardCard v-for="s in filteredSedes" :key="s.id" :title="s.nombre">
            <div class="gmb-stats">
              <div class="gmb-stat">
                <span class="gmb-icon">⭐</span>
                <span class="gmb-val">{{ s.gmb_rating }}</span>
                <span class="gmb-label">Calificación</span>
              </div>
              <div class="gmb-stat">
                <span class="gmb-icon">💬</span>
                <span class="gmb-val">{{ s.gmb_reviews }}</span>
                <span class="gmb-label">Reseñas</span>
              </div>
            </div>

            <div v-if="s.gmb_unanswered > 0" class="gmb-alert">
              Tienes {{ s.gmb_unanswered }} reseña(s) sin responder
            </div>

            <div class="gmb-pub-card mt-1" v-if="s.gmb_latest_pub">
              <h4>Última publicación</h4>
              <p class="pub-text">"{{ s.gmb_latest_pub }}"</p>
              <div class="pub-footer">
                <span>👁️ {{ s.gmb_pub_views }} visualizaciones</span>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>

    </template>

    <div v-if="!loading && !clientData" class="loading-state">No se encontró tu perfil. Contacta con la agencia.</div>

    <!-- Modal: Abrir ticket de soporte -->
    <div class="modal-overlay" v-if="showTicketModal">
      <div class="modal-box">
        <p class="modal-title">✉ Solicitud de Soporte</p>
        <p class="modal-subtitle">Describe tu consulta y nos pondremos en contacto contigo lo antes posible.</p>
        <div class="form-group">
          <label>Asunto *</label>
          <input v-model="ticketForm.asunto" class="form-input" placeholder="Ej: Problema con mi factura de marzo" maxlength="120" />
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea v-model="ticketForm.descripcion" class="form-input" rows="4" placeholder="Cuéntanos con más detalle qué necesitas…"></textarea>
        </div>
        <div class="form-group">
          <label>Urgencia</label>
          <select v-model="ticketForm.prioridad" class="form-input">
            <option value="Baja">Normal — No es urgente</option>
            <option value="Media">Media — En los próximos días</option>
            <option value="Alta">Alta — Lo antes posible</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showTicketModal = false">Cancelar</button>
          <button class="btn-primary" @click="submitTicket" :disabled="savingTicket || !ticketForm.asunto.trim()">
            {{ savingTicket ? 'Enviando…' : 'Enviar solicitud' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Editar perfil -->
    <div class="modal-overlay" v-if="showEditModal">
      <div class="modal-box">
        <p class="modal-title">Editar Mi Perfil</p>
        <div class="form-group"><label>Nombre de empresa</label><input v-model="editForm.name" class="form-input" /></div>
        <div class="form-group"><label>Nombre de contacto</label><input v-model="editForm.contact" class="form-input" /></div>
        <div class="form-group"><label>URL del logo</label><input v-model="editForm.logo" class="form-input" placeholder="https://..." /></div>
        <div class="modal-actions">
          <button class="btn-text" @click="showEditModal = false">Cancelar</button>
          <button class="btn-primary" @click="handleSaveProfile" :disabled="savingProfile">
            {{ savingProfile ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }
.loading-state { color: var(--color-text-muted); font-style: italic; padding: 2rem 0; }

.welcome-header { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, rgba(227,255,4,0.08) 0%, transparent 100%), var(--color-bg-card); padding: 2.5rem; border-radius: 12px; border: 1px solid var(--color-primary); flex-wrap: wrap; gap: 2rem; }
.welcome-text { flex: 1; }
.welcome-text h1 { font-size: 2rem; margin: 0 0 0.5rem; color: var(--color-primary); }
.welcome-text p { font-size: 1rem; color: var(--color-text-light); margin: 0 0 1rem; }
.location-filter { display: flex; align-items: center; gap: 0.75rem; }
.location-filter label { font-weight: 600; font-size: 0.9rem; }
.custom-select { background: var(--color-bg-lighter); color: var(--color-text-light); border: 1px solid var(--color-border); padding: 0.4rem 0.8rem; border-radius: 4px; outline: none; color-scheme: dark; }
.client-brand { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.client-logo, .logo-placeholder { width: 80px; height: 80px; border-radius: 12px; border: 2px solid var(--color-primary); object-fit: cover; }
.logo-placeholder { background: var(--color-primary); color: #000; font-size: 2rem; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.brand-name { font-weight: 700; font-size: 1rem; }
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px; cursor: pointer; }
.btn-outline { background: transparent; border: 1px dashed var(--color-text-muted); color: var(--color-text-muted); }
.btn-outline:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn-soporte { background: rgba(227,255,4,0.12); border: 1px solid rgba(227,255,4,0.4); color: var(--color-primary); font-weight: 700; }
.btn-soporte:hover { background: rgba(227,255,4,0.2); }

/* ── Status banner ─── */
.status-banner {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.9rem 1.25rem; border-radius: 10px; border: 1px solid transparent;
  font-size: 0.9rem; flex-wrap: wrap;
}
.status-banner.success { background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.3); color: #4ade80; }
.status-banner.warning { background: rgba(255,165,0,0.08); border-color: rgba(255,165,0,0.3); color: #ffa500; }
.status-banner.danger  { background: rgba(255,68,68,0.08);  border-color: rgba(255,68,68,0.3);  color: #f87171; }
.status-banner-icon { font-size: 1.2rem; flex-shrink: 0; }
.status-banner-msg  { flex: 1; color: var(--color-text-light); }
.btn-soporte-banner {
  background: transparent; border: 1px solid currentColor; color: inherit;
  padding: 0.3rem 0.8rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer;
  transition: background 0.2s; white-space: nowrap;
}
.btn-soporte-banner:hover { background: rgba(255,255,255,0.1); }

/* ── Facturas por proyecto ─── */
.facturas-grupos { display: flex; flex-direction: column; gap: 1.25rem; }
.facturas-grupo { display: flex; flex-direction: column; gap: 0.4rem; }
.facturas-grupo-titulo {
  font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--color-text-muted);
  margin-bottom: 0.2rem; padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--color-border);
}
.factura-row-cliente {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.65rem 0.9rem; background: rgba(255,255,255,0.02);
  border: 1px solid var(--color-border); border-radius: 8px; flex-wrap: wrap;
}
.factura-info { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; flex-wrap: wrap; }
.factura-num { font-family: monospace; font-size: 0.8rem; color: var(--color-primary); font-weight: 700; white-space: nowrap; }
.factura-concepto { font-size: 0.88rem; color: var(--color-text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 80px; }
.factura-right-cliente { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.factura-estado-badge {
  font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.5rem;
  border-radius: 4px; white-space: nowrap;
}
.factura-estado-badge.pagada   { background: rgba(74,222,128,0.15); color: #4ade80; }
.factura-estado-badge.pendiente{ background: rgba(255,165,0,0.15);  color: #ffa500; }
.factura-estado-badge.vencida  { background: rgba(255,68,68,0.15);  color: #f87171; }
.btn-pdf-cliente {
  background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted);
  padding: 0.28rem 0.65rem; border-radius: 6px; font-size: 0.78rem; font-weight: 700;
  cursor: pointer; transition: border-color 0.2s, color 0.2s; white-space: nowrap;
}
.btn-pdf-cliente:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.btn-pdf-cliente:disabled { opacity: 0.5; cursor: default; }

/* Modal subtitle */
.modal-subtitle { font-size: 0.85rem; color: var(--color-text-muted); margin: -0.75rem 0 1.25rem; }

.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 900px) {
  .content-grid { grid-template-columns: 1fr; }
  .welcome-header { flex-direction: column-reverse; align-items: flex-start; }
}

.activity-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.activity-list li { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius: 8px; }
.act-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.act-text { display: flex; flex-direction: column; flex: 1; gap: 0.25rem; }
.act-text strong { font-size: 0.95rem; }
.act-text span { font-size: 0.8rem; color: var(--color-text-muted); }
.progress-bar-wrap { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-top: 6px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.progress-pct { font-size: 0.78rem; color: var(--color-text-muted); font-weight: 600; white-space: nowrap; flex-shrink: 0; margin-top: 2px; }

.tickets-list { list-style: none; padding: 0; display: flex; flex-direction: column; }
.ticket-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 0.5rem; border-bottom: 1px solid var(--color-border); }
.ticket-row:last-child { border-bottom: none; }
.ticket-info { display: flex; flex-direction: column; flex: 1; gap: 0.15rem; }
.ticket-asunto { font-size: 0.9rem; font-weight: 600; }
.ticket-fecha  { font-size: 0.75rem; color: var(--color-text-muted); }
.ticket-badge  { font-size: 0.72rem; font-weight: 600; padding: 2px 10px; border-radius: 10px; border: 1px solid; white-space: nowrap; flex-shrink: 0; }
.ticket-closed { flex-wrap: wrap; align-items: flex-start; }
.ticket-resolucion { width: 100%; margin-top: 0.4rem; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.05); border-left: 3px solid #4ade80; border-radius: 0 6px 6px 0; font-size: 0.82rem; color: var(--color-text-light); line-height: 1.4; }
.ticket-resolucion-label { font-weight: 700; color: #4ade80; margin-right: 0.4rem; }
.ticket-rating { width: 100%; margin-top: 0.35rem; display: flex; align-items: center; gap: 0.25rem; }
.ticket-rating-label { font-size: 0.78rem; color: var(--color-text-muted); margin-right: 0.2rem; }
.star { font-size: 1.2rem; color: #555; cursor: pointer; transition: color 0.15s, transform 0.1s; line-height: 1; }
.star.active { color: #fbbf24; }
.star:not(.readonly):hover { color: #fbbf24; transform: scale(1.2); }
.star.readonly { cursor: default; }
.empty-state-small { color: var(--color-text-muted); font-size: 0.85rem; padding: 0.5rem 0; }
.status-pill { font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 10px; border: 1px solid; flex-shrink: 0; }

.upload-area { border: 2px dashed rgba(227,255,4,0.4); padding: 1.5rem; text-align: center; border-radius: 8px; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s; background: rgba(227,255,4,0.02); }
.upload-area:hover, .upload-area.uploading { border-color: var(--color-primary); background: rgba(227,255,4,0.06); }
.hidden-input { display: none; }
.upload-icon { font-size: 1.8rem; margin-bottom: 0.3rem; }
.upload-hint { font-size: 0.8rem; color: var(--color-text-muted); display: block; margin-top: 0.25rem; }
.error-msg { color: #ff4444; font-size: 0.85rem; margin-bottom: 0.75rem; }
.docs-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.doc-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--color-bg-lighter); border-radius: 8px; }
.doc-info { display: flex; gap: 0.75rem; align-items: center; overflow: hidden; flex: 1; }
.doc-icon { font-size: 1.2rem; flex-shrink: 0; }
.doc-meta { display: flex; flex-direction: column; overflow: hidden; }
.doc-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-details { font-size: 0.78rem; color: var(--color-text-muted); }
.text-primary { color: var(--color-primary); }
.btn-view { background: var(--color-primary); color: #000; padding: 0.35rem 0.8rem; border-radius: 4px; font-weight: 600; font-size: 0.82rem; text-decoration: none; flex-shrink: 0; cursor: pointer; border: none; }
.links-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0; }
.link-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 0.5rem; border-bottom: 1px solid var(--color-border); }
.link-item:last-child { border-bottom: none; }
.link-icon { font-size: 1.2rem; flex-shrink: 0; }
.link-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.link-titulo { font-weight: 600; font-size: 0.9rem; }
.link-desc { font-size: 0.8rem; color: var(--color-text-muted); }

.section-title { font-size: 1.2rem; color: var(--color-text-muted); margin-bottom: 1rem; }
.gmb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
.gmb-stats { display: flex; gap: 1rem; margin-bottom: 1rem; }
.gmb-stat { flex: 1; display: flex; flex-direction: column; align-items: center; background: var(--color-bg-lighter); padding: 1rem; border-radius: 8px; }
.gmb-icon { font-size: 1.3rem; margin-bottom: 0.2rem; }
.gmb-val { font-size: 1.5rem; font-weight: 700; }
.gmb-label { font-size: 0.78rem; color: var(--color-text-muted); }
.gmb-alert { background: rgba(248,113,113,0.1); color: #f87171; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(248,113,113,0.3); text-align: center; font-size: 0.9rem; margin-bottom: 0.75rem; }
.gmb-pub-card { background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--color-primary); }
.gmb-pub-card h4 { margin: 0 0 0.4rem; font-size: 0.85rem; color: var(--color-text-muted); }
.pub-text { font-style: italic; margin: 0 0 0.5rem; font-size: 0.95rem; }
.pub-footer { font-size: 0.82rem; color: var(--color-primary); font-weight: 600; }
.mt-1 { margin-top: 0.75rem; }
.empty-state { color: var(--color-text-muted); font-style: italic; text-align: center; padding: 1.5rem; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.9rem 1.1rem; border-radius: 6px; font-family: inherit; font-size: 1rem; outline: none; width: 100%; box-sizing: border-box; }
.form-input:focus { border-color: var(--color-primary); }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }
.btn-primary { background: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.4rem; border-radius: 6px; border: none; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* Informes */
.informes-section { margin-top: 0.5rem; }
.informes-grid { display: flex; flex-direction: column; gap: 0.75rem; }
.informe-card {
  display: flex; align-items: center; gap: 1rem; padding: 1.25rem;
  background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px;
  transition: border-color 0.2s, transform 0.15s;
}
.informe-card:hover { border-color: var(--color-primary); transform: translateY(-2px); }
.informe-icon { font-size: 2rem; flex-shrink: 0; }
.informe-body { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; overflow: hidden; }
.informe-titulo { font-size: 1rem; color: var(--color-text-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.informe-meta { font-size: 0.82rem; color: var(--color-text-muted); }
.informe-fecha { font-size: 0.75rem; color: rgba(255,255,255,0.3); }
.btn-download {
  background: var(--color-primary); color: #000; font-weight: 700;
  padding: 0.55rem 1.1rem; border-radius: 8px; text-decoration: none;
  font-size: 0.85rem; white-space: nowrap; flex-shrink: 0;
  transition: all 0.15s;
}
.btn-download:hover { background: #d4ed00; transform: scale(1.03); }

@media (max-width: 600px) {
  .informe-card { flex-direction: column; align-items: flex-start; }
  .btn-download { width: 100%; text-align: center; }
}

/* Report Detail Modal Styles */
.report-modal { max-width: 900px !important; width: 95% !important; max-height: 90vh !important; display: flex; flex-direction: column; padding: 0 !important; background: #000 !important; color: #fff !important; }
.report-modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: flex-start; background: #000; border-radius: 12px 12px 0 0; }
.report-modal-title h2 { margin: 0; font-size: 1.4rem; color: var(--color-primary); }
.report-modal-title p { margin: 0.25rem 0 0; font-size: 0.85rem; color: #888; }
.report-modal-content { padding: 2.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 2.5rem; background: #000; }

.rg-preview-titulo { font-size: 1.8rem; font-weight: 800; color: var(--color-primary); border-bottom: 2px solid var(--color-primary); padding-bottom: 0.5rem; margin-top: -1rem; }

.report-section { display: flex; flex-direction: column; gap: 0.75rem; text-align: left; }
.report-section label { font-size: 0.75rem; font-weight: 800; color: #aaa; letter-spacing: 0.1em; text-transform: uppercase; }
.report-section p { margin: 0; line-height: 1.6; color: #eee; font-size: 1rem; white-space: pre-line; }
.resumen-text-box { border-left: 3px solid var(--color-primary); padding: 1.25rem !important; background: rgba(227,255,4,0.03); border-radius: 4px; }
.adjuntos-cliente-list { display: flex; flex-direction: column; gap: 0.4rem; }
.adjunto-cliente-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.9rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: var(--color-text-light); text-decoration: none; transition: border-color 0.2s, color 0.2s; }
.adjunto-cliente-item:hover { border-color: var(--color-primary); color: var(--color-primary); }
.adj-icon { font-size: 1.1rem; flex-shrink: 0; }
.adj-nombre { flex: 1; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adj-size { font-size: 0.75rem; color: var(--color-text-muted); white-space: nowrap; }
.adj-dl { margin-left: auto; font-size: 0.85rem; color: var(--color-text-muted); flex-shrink: 0; }

.client-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.25rem; }
.client-kpi-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 1.25rem; border-radius: 12px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.client-kpi-val { font-size: 1.8rem; font-weight: 800; color: var(--color-primary); }
.client-kpi-label { font-size: 0.75rem; color: #888; text-transform: uppercase; margin-top: 0.35rem; }

.client-tareas-list { display: flex; flex-direction: column; gap: 0.85rem; }
.client-tarea-item { display: flex; align-items: center; gap: 1rem; padding: 1.15rem; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); }
.client-tarea-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.client-tarea-text { flex: 1; text-align: left; }
.client-tarea-text strong { display: block; font-size: 1rem; margin-bottom: 0.2rem; color: #fff; }
.client-tarea-text p { font-size: 0.9rem !important; color: #888 !important; margin: 0 !important; }
.client-tarea-hours { font-size: 0.9rem; font-weight: 700; color: var(--color-primary); padding: 0.25rem 0.5rem; background: rgba(227,255,4,0.1); border-radius: 4px; }

.client-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
.client-gallery img { width: 100%; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }

.report-double-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; }
.client-steps-dots { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.client-steps-dots li { font-size: 0.95rem; color: #ccc; display: flex; align-items: flex-start; gap: 0.75rem; }
.client-steps-dots li::before { content: "•"; color: var(--color-primary); font-weight: bold; }

.client-steps-ordered { counter-reset: my-counter; list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.client-steps-ordered li { counter-increment: my-counter; font-size: 0.95rem; color: #ccc; display: flex; align-items: flex-start; gap: 0.85rem; }
.client-steps-ordered li::before { content: counter(my-counter); width: 22px; height: 22px; background: var(--color-primary); color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; flex-shrink: 0; }

.informe-actions { display: flex; align-items: center; gap: 1rem; }
.informe-actions .btn-text { font-weight: 700; font-size: 0.85rem; color: var(--color-primary); }

@media (max-width: 800px) {
  .report-double-grid { grid-template-columns: 1fr; }
  .report-modal-content { padding: 1.5rem; gap: 1.75rem; }
}
</style>
