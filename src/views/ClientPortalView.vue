<script setup lang="ts">
import { ref, computed } from 'vue';
import DashboardCard from '../components/DashboardCard.vue';
import ClientReportModule from '../components/ClientReportModule.vue';
import { authStore } from '../store/auth';
import { useClientProfile, type CuentaCliente } from '../services/clients';
import { ESTADO_COLORS } from '../services/operations';
import { generateInvoicePDF, type Factura } from '../services/financial';
import { createTicket, useClientTickets } from '../services/support';
import { useToast } from '../composables/useToast';
import { supabase } from '../supabase';

const clientId = authStore.user?.clientId ?? '';
const {
  clientData, proyectos, sedes, documentos, facturas, cuentas,
  financials, loading,
  uploadDocumento, saveProfile,
} = useClientProfile(clientId);

const toast = useToast();

const { tickets: misTickets } = useClientTickets(clientId);

// ── Cuentas asociadas — revelado con verificación ─────────────────────────────
const cuentasDesbloqueadas = ref(false);   // true tras verificar contraseña una vez
const revealedIds = ref<Set<string>>(new Set());
const showVerifyModal = ref(false);
const pendingRevealId = ref<string | null>(null);
const verifyInput = ref('');
const verifyError = ref('');
const verifyLoading = ref(false);

const toggleReveal = (c: CuentaCliente) => {
  if (revealedIds.value.has(c.id)) {
    revealedIds.value = new Set([...revealedIds.value].filter(id => id !== c.id));
    return;
  }
  if (cuentasDesbloqueadas.value) {
    revealedIds.value = new Set([...revealedIds.value, c.id]);
    return;
  }
  pendingRevealId.value = c.id;
  verifyInput.value = '';
  verifyError.value = '';
  showVerifyModal.value = true;
};

const confirmarVerificacion = async () => {
  if (!verifyInput.value) return;
  verifyLoading.value = true;
  verifyError.value = '';
  try {
    const email = authStore.user?.email ?? '';
    const { error } = await supabase.auth.signInWithPassword({ email, password: verifyInput.value });
    if (error) throw error;
    cuentasDesbloqueadas.value = true;
    if (pendingRevealId.value) {
      revealedIds.value = new Set([...revealedIds.value, pendingRevealId.value]);
      pendingRevealId.value = null;
    }
    showVerifyModal.value = false;
  } catch {
    verifyError.value = 'Contraseña incorrecta. Inténtalo de nuevo.';
  } finally {
    verifyLoading.value = false;
  }
};

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
    toast.success('Tu solicitud de soporte ha sido enviada. Te responderemos pronto.');
  } catch {
    toast.error('No se pudo enviar la solicitud. Inténtalo de nuevo.');
  } finally {
    savingTicket.value = false;
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
</script>

<template>
  <div class="view-container">
    <div v-if="loading" class="loading-state">Cargando tu panel...</div>

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

      <!-- Resumen financiero (sólo visible en "todas las sedes") -->
      <div v-if="selectedSedeId === 'all'" class="fin-section">
        <div class="fin-summary">
          <div class="fin-box success">
            <span class="fin-label">Abonado</span>
            <span class="fin-value">{{ financials.paid }}</span>
          </div>
          <div class="fin-box warning">
            <span class="fin-label">Por pagar</span>
            <span class="fin-value">{{ financials.pending }}</span>
          </div>
          <div class="fin-box neutral">
            <span class="fin-label">Total facturado</span>
            <span class="fin-value">{{ financials.total }}</span>
          </div>
        </div>

        <!-- Lista de facturas con descarga PDF -->
        <div v-if="facturas.length > 0" class="facturas-cliente">
          <div v-for="f in facturas" :key="f.id" class="factura-row-cliente">
            <div class="factura-info">
              <span class="factura-num">{{ f.numero_factura ?? 'Borrador' }}</span>
              <span class="factura-concepto">{{ f.concepto }}</span>
              <span class="factura-importe">{{ f.importe.toLocaleString('es-ES') }} €</span>
            </div>
            <div class="factura-right-cliente">
              <span
                class="factura-estado-badge"
                :class="f.estado.toLowerCase()"
              >{{ f.estado }}</span>
              <button
                class="btn-pdf-cliente"
                :disabled="downloadingInvoice === f.id"
                @click="downloadInvoicePdf(f)"
                title="Descargar PDF"
              >
                {{ downloadingInvoice === f.id ? '⏳' : '⬇' }} PDF
              </button>
            </div>
          </div>
        </div>
      </div>

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
              <a :href="doc.url" target="_blank" class="btn-view">👀 Ver</a>
            </li>
          </ul>
        </DashboardCard>
      </div>

      <!-- Cuentas Asociadas -->
      <DashboardCard v-if="cuentas.length > 0" title="Cuentas Asociadas">
        <ul class="cuentas-list">
          <li v-for="c in cuentas" :key="c.id" class="cuenta-item">
            <div class="cuenta-header">
              <span class="cuenta-titulo">🔑 {{ c.titulo }}</span>
              <a v-if="c.url" :href="c.url" target="_blank" rel="noopener" class="cuenta-link-btn" title="Abrir">↗</a>
            </div>
            <div class="cuenta-row" v-if="c.usuario">
              <span class="cuenta-label">Usuario</span>
              <span class="cuenta-val">{{ revealedIds.has(c.id) ? c.usuario : '••••••••••••' }}</span>
              <button class="reveal-btn" @click="toggleReveal(c)" :title="revealedIds.has(c.id) ? 'Ocultar' : 'Revelar'">
                {{ revealedIds.has(c.id) ? '🙈' : '👁️' }}
              </button>
            </div>
            <div class="cuenta-row" v-if="c.password">
              <span class="cuenta-label">Contraseña</span>
              <span class="cuenta-val">{{ revealedIds.has(c.id) ? c.password : '••••••••••••' }}</span>
              <button v-if="!c.usuario" class="reveal-btn" @click="toggleReveal(c)" :title="revealedIds.has(c.id) ? 'Ocultar' : 'Revelar'">
                {{ revealedIds.has(c.id) ? '🙈' : '👁️' }}
              </button>
            </div>
          </li>
        </ul>
      </DashboardCard>

      <!-- Modal: Verificar identidad -->
      <div class="modal-overlay" v-if="showVerifyModal" @click.self="showVerifyModal = false">
        <div class="modal-box">
          <p class="modal-title">🔒 Verificar identidad</p>
          <p style="color:var(--color-text-muted);font-size:0.88rem;margin-bottom:1.25rem;">
            Introduce tu contraseña para revelar las credenciales. Solo se pedirá una vez por sesión.
          </p>
          <div class="form-group">
            <label>Contraseña de tu cuenta</label>
            <input
              v-model="verifyInput"
              type="password"
              class="form-input"
              placeholder="••••••••"
              @keyup.enter="confirmarVerificacion"
              autofocus
            />
          </div>
          <p v-if="verifyError" class="error-msg">{{ verifyError }}</p>
          <div class="modal-actions">
            <button class="btn-text" @click="showVerifyModal = false">Cancelar</button>
            <button class="btn-primary" @click="confirmarVerificacion" :disabled="verifyLoading || !verifyInput">
              {{ verifyLoading ? 'Verificando...' : 'Verificar' }}
            </button>
          </div>
        </div>
      </div>

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
          <li v-for="t in misTickets" :key="t.id" class="ticket-row">
            <div class="ticket-info">
              <span class="ticket-asunto">{{ t.asunto }}</span>
              <span class="ticket-fecha">{{ formatDate(t.fecha_creacion) }}</span>
            </div>
            <span class="ticket-badge" :style="{ color: TICKET_COLOR[t.estado], borderColor: TICKET_COLOR[t.estado] + '55' }">
              {{ t.estado }}
            </span>
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
    <div class="modal-overlay" v-if="showTicketModal" @click.self="showTicketModal = false">
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
    <div class="modal-overlay" v-if="showEditModal" @click.self="showEditModal = false">
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

/* ── Financial section ─── */
.fin-section { display: flex; flex-direction: column; gap: 1rem; }
.fin-summary { display: flex; gap: 1rem; }
.fin-box { flex: 1; background: var(--color-bg-card); border: 1px solid transparent; padding: 1.25rem; border-radius: 10px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.fin-box.success { border-color: rgba(74,222,128,0.3); color: #4ade80; }
.fin-box.warning { border-color: rgba(250,204,21,0.3); color: #facc15; }
.fin-box.neutral { border-color: var(--color-border); }
.fin-label { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 0.4rem; }
.fin-value { font-size: 1.6rem; font-weight: 700; }

/* ── Facturas cliente ─── */
.facturas-cliente { display: flex; flex-direction: column; gap: 0.5rem; }
.factura-row-cliente {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.7rem 1rem; background: var(--color-bg-card);
  border: 1px solid var(--color-border); border-radius: 8px; flex-wrap: wrap;
}
.factura-info { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; flex-wrap: wrap; }
.factura-num { font-family: monospace; font-size: 0.8rem; color: var(--color-primary); font-weight: 700; white-space: nowrap; }
.factura-concepto { font-size: 0.88rem; color: var(--color-text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 80px; }
.factura-importe { font-weight: 700; font-size: 0.9rem; white-space: nowrap; }
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
  .fin-summary { flex-direction: column; }
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
.empty-state-small { color: var(--color-text-muted); font-size: 0.85rem; padding: 0.5rem 0; }
.status-pill { font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 10px; border: 1px solid; flex-shrink: 0; }

.upload-area { border: 2px dashed rgba(227,255,4,0.4); padding: 1.5rem; text-align: center; border-radius: 8px; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s; background: rgba(227,255,4,0.02); }
.upload-area:hover, .upload-area.uploading { border-color: var(--color-primary); background: rgba(227,255,4,0.06); }
.hidden-input { display: none; }
.upload-icon { font-size: 1.8rem; margin-bottom: 0.3rem; }
.upload-hint { font-size: 0.8rem; color: var(--color-text-muted); display: block; margin-top: 0.25rem; }
.error-msg { color: #ff4444; font-size: 0.85rem; margin-bottom: 0.75rem; }
/* Cuentas */
.cuentas-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.cuenta-item { background: var(--color-bg-lighter); border-radius: 8px; padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.cuenta-header { display: flex; align-items: center; justify-content: space-between; }
.cuenta-titulo { font-weight: 700; font-size: 0.95rem; color: var(--color-text-light); }
.cuenta-link-btn { background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted); border-radius: 4px; padding: 0.15rem 0.5rem; font-size: 0.8rem; cursor: pointer; text-decoration: none; }
.cuenta-link-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.cuenta-row { display: flex; align-items: center; gap: 0.75rem; }
.cuenta-label { font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; min-width: 80px; }
.cuenta-val { font-family: monospace; font-size: 0.9rem; color: var(--color-text-light); flex: 1; letter-spacing: 0.05em; }
.reveal-btn { background: transparent; border: none; cursor: pointer; font-size: 1rem; padding: 0.1rem 0.3rem; border-radius: 4px; opacity: 0.7; }
.reveal-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }
.docs-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.doc-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--color-bg-lighter); border-radius: 8px; }
.doc-info { display: flex; gap: 0.75rem; align-items: center; overflow: hidden; flex: 1; }
.doc-icon { font-size: 1.2rem; flex-shrink: 0; }
.doc-meta { display: flex; flex-direction: column; overflow: hidden; }
.doc-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-details { font-size: 0.78rem; color: var(--color-text-muted); }
.text-primary { color: var(--color-primary); }
.btn-view { background: var(--color-primary); color: #000; padding: 0.35rem 0.8rem; border-radius: 4px; font-weight: 600; font-size: 0.82rem; text-decoration: none; flex-shrink: 0; }

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
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; }
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
