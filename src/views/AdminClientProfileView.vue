<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DashboardCard from '../components/DashboardCard.vue';
import ClientReportGenerator from '../components/ClientReportGenerator.vue';
import ClientReportModule from '../components/ClientReportModule.vue';
import { useClientProfile, computeHealthScore, healthColor, healthLabel, type Sede } from '../services/clients';
import { ESTADO_COLORS } from '../services/operations';
import { ESTADO_COLORS as LEAD_ESTADO_COLORS } from '../services/commercial';
import { type InformeGuardado } from '../services/reportes';
import { type CuentaCliente } from '../services/clients';
import { useGmbHistorico, tomarSnapshot } from '../services/gmbHistorico';
import GmbChart from '../components/GmbChart.vue';
import { generarInformeMensualPDF } from '../services/informeMensual';
import { useToast } from '../composables/useToast';
import { supabase } from '../supabase';

const route = useRoute();
const router = useRouter();
const clientId = route.params.id as string;
const toast = useToast();
const {
  clientData, facturas, proyectos, sedes, documentos, usuarios, leads,
  financials, loading,
  saveProfile, addSede, updateSede, deleteSede,
  uploadDocumento, deleteDocumento,
  cuentas, addCuenta, updateCuenta, deleteCuenta,
} = useClientProfile(clientId);

function goToCommercial() {
  router.push('/commercial');
}

function formatLeadDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatLeadValue(v: number): string {
  if (!v) return '—';
  return `${Number(v).toLocaleString('es-ES')} €`;
}

// ── Filtro de sede ────────────────────────────────────────────────────────────
const selectedSedeId = ref<number | 'all'>('all');

const filteredProyectos = computed(() => {
  if (!proyectos.value.length) return [];
  if (selectedSedeId.value === 'all') return proyectos.value;
  return proyectos.value.filter((p: any) => p.sede_id === selectedSedeId.value);
});

const filteredDocumentos = computed(() => {
  if (selectedSedeId.value === 'all') return documentos.value;
  return documentos.value.filter((d: any) => d.sede_id === selectedSedeId.value);
});

const filteredSedes = computed(() => {
  if (!sedes.value.length) return [];
  if (selectedSedeId.value === 'all') return sedes.value;
  return sedes.value.filter(s => s.id === selectedSedeId.value);
});

// ── Editar perfil ─────────────────────────────────────────────────────────────
const showEditModal = ref(false);
const editForm = ref({ name: '', contact: '', contactEmail: '', telefono: '', industry: '', logo: '', status: '', cif: '', direccionFacturacion: '' });
const savingProfile = ref(false);

const openEditModal = () => {
  if (!clientData.value) return;
  editForm.value = {
    name: clientData.value.name,
    contact: clientData.value.contact,
    contactEmail: clientData.value.contactEmail ?? '',
    telefono: clientData.value.telefono ?? '',
    industry: clientData.value.industry,
    logo: clientData.value.logo,
    status: clientData.value.status,
    cif: clientData.value.cif ?? '',
    direccionFacturacion: clientData.value.direccionFacturacion ?? '',
  };
  showEditModal.value = true;
};
const handleSaveProfile = async () => {
  savingProfile.value = true;
  try {
    await saveProfile(editForm.value);
    showEditModal.value = false;
  } catch (error: any) {
    console.error('[handleSaveProfile] Error:', error);
    alert('Error al actualizar el perfil: ' + (error.message || 'No se pudo guardar'));
  } finally {
    savingProfile.value = false;
  }
};

// ── Añadir / editar sede ──────────────────────────────────────────────────────
const showSedeModal = ref(false);
const editingSedeId = ref<number | null>(null);
const savingSede = ref(false);
const emptySede = (): Partial<Sede> => ({
  nombre: '', gmb_rating: 0, gmb_reviews: 0,
  gmb_unanswered: 0, gmb_latest_pub: '', gmb_pub_views: 0,
});
const sedeForm = ref<Partial<Sede>>(emptySede());

const openNewSede = () => { sedeForm.value = emptySede(); editingSedeId.value = null; showSedeModal.value = true; };
const openEditSede = (s: Sede) => { sedeForm.value = { ...s }; editingSedeId.value = s.id; showSedeModal.value = true; };

const saveSede = async () => {
  savingSede.value = true;
  try {
    if (editingSedeId.value !== null) {
      await updateSede(editingSedeId.value, sedeForm.value);
    } else {
      await addSede(sedeForm.value);
    }
    showSedeModal.value = false;
  } catch (error: any) {
    console.error('[saveSede] Error:', error);
    alert('Error al guardar la sede: ' + (error.message || 'No se pudo completar la operación'));
  } finally {
    savingSede.value = false;
  }
};

const confirmDeleteSede = async (s: Sede) => {
  if (!confirm(`¿Eliminar la sede "${s.nombre}"? Se eliminarán también sus documentos y proyectos asociados.`)) return;
  try {
    await deleteSede(s.id);
  } catch (error: any) {
    console.error('[confirmDeleteSede] Error:', error);
    alert('Error al eliminar la sede: ' + (error.message || 'No se pudo eliminar'));
  }
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
    await uploadDocumento(file, sedeId, 'Agencia');
  } catch (err: any) {
    uploadError.value = err.message ?? 'Error al subir archivo';
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
};

const confirmDeleteDoc = async (doc: any) => {
  if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
  await deleteDocumento(doc);
};

const editingDocId = ref<number | null>(null);
const editingDocNombre = ref('');
const editingDocSedeId = ref<number | null>(null);

const startEditDoc = (doc: any) => { editingDocId.value = doc.id; editingDocNombre.value = doc.nombre; editingDocSedeId.value = doc.sede_id; };
const cancelEditDoc = () => { editingDocId.value = null; };
const saveDocNombre = async (doc: any) => {
  const nombre = editingDocNombre.value.trim();
  if (!nombre) return;
  const updates: any = { nombre, sede_id: editingDocSedeId.value };
  await supabase.from('documentos').update(updates).eq('id', doc.id);
  doc.nombre = nombre;
  doc.sede_id = editingDocSedeId.value;
  editingDocId.value = null;
};

// ── Links de cliente ──────────────────────────────────────────────────────────
type LinkCliente = { id: string; titulo: string; url: string; descripcion: string | null };
const links = ref<LinkCliente[]>([]);
const linkForm = ref({ titulo: '', url: '', descripcion: '' });
const savingLink = ref(false);
const showLinkForm = ref(false);

const loadLinks = async () => {
  const { data } = await supabase.from('links_cliente').select('*').eq('cliente_id', clientId).order('created_at', { ascending: false });
  links.value = (data ?? []) as LinkCliente[];
};

async function notifyLinkToClientUsers(cId: string, cName: string, link: LinkCliente) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action:      'notify-link',
        cliente_id:  cId,
        clientName:  cName,
        titulo:      link.titulo,
        url:         link.url,
        descripcion: link.descripcion ?? null,
      },
    });
    if (error) {
      console.error('[notify-link]', error);
      toast.success('Link guardado. (No se pudo enviar la notificación por email)');
    } else if ((data?.sent ?? 0) > 0) {
      toast.success(`Link guardado. Notificación enviada a ${data.sent} usuario${data.sent > 1 ? 's' : ''}.`);
    } else {
      toast.success('Link guardado. (Sin usuarios con email para notificar)');
    }
  } catch (err) {
    console.error('[notify-link]', err);
    toast.success('Link guardado correctamente.');
  }
}

const saveLink = async () => {
  if (!linkForm.value.titulo.trim() || !linkForm.value.url.trim()) return;
  savingLink.value = true;
  try {
    const { data, error } = await supabase.from('links_cliente').insert({
      cliente_id: clientId,
      titulo: linkForm.value.titulo.trim(),
      url: linkForm.value.url.trim(),
      descripcion: linkForm.value.descripcion.trim() || null,
    }).select().single();
    if (error) throw error;
    links.value.unshift(data as LinkCliente);

    const linkData   = data as LinkCliente;
    const clientName = clientData.value?.name ?? '';
    notifyLinkToClientUsers(clientId, clientName, linkData);

    linkForm.value = { titulo: '', url: '', descripcion: '' };
    showLinkForm.value = false;
  } finally {
    savingLink.value = false;
  }
};

const deleteLink = async (id: string) => {
  if (!confirm('¿Eliminar este link?')) return;
  await supabase.from('links_cliente').delete().eq('id', id);
  links.value = links.value.filter(l => l.id !== id);
};

const editingLinkId = ref<string | null>(null);
const editingLinkForm = ref({ titulo: '', url: '', descripcion: '' });

const startEditLink = (l: LinkCliente) => {
  editingLinkId.value = l.id;
  editingLinkForm.value = { titulo: l.titulo, url: l.url, descripcion: l.descripcion ?? '' };
};
const cancelEditLink = () => { editingLinkId.value = null; };

// ── Cuentas asociadas ─────────────────────────────────────────────────────────
const showCuentaModal = ref(false);
const savingCuenta = ref(false);
const editingCuentaId = ref<string | null>(null);
const cuentaForm = ref({ titulo: '', url: '', usuario: '', password: '' });
const showCuentaPass = ref(false);

const openNewCuenta = () => {
  editingCuentaId.value = null;
  cuentaForm.value = { titulo: '', url: '', usuario: '', password: '' };
  showCuentaPass.value = false;
  showCuentaModal.value = true;
};
const openEditCuenta = (c: CuentaCliente) => {
  editingCuentaId.value = c.id;
  cuentaForm.value = { titulo: c.titulo, url: c.url, usuario: c.usuario, password: c.password };
  showCuentaPass.value = false;
  showCuentaModal.value = true;
};
const saveCuenta = async () => {
  if (!cuentaForm.value.titulo.trim()) return;
  savingCuenta.value = true;
  try {
    if (editingCuentaId.value) {
      await updateCuenta(editingCuentaId.value, cuentaForm.value);
    } else {
      await addCuenta(cuentaForm.value);
    }
    showCuentaModal.value = false;
  } catch (err: any) {
    alert('Error al guardar: ' + (err?.message ?? ''));
  } finally {
    savingCuenta.value = false;
  }
};
const confirmDeleteCuenta = async (c: CuentaCliente) => {
  if (!confirm(`¿Eliminar la cuenta "${c.titulo}"?`)) return;
  await deleteCuenta(c.id);
};
const saveEditLink = async (l: LinkCliente) => {
  if (!editingLinkForm.value.titulo.trim() || !editingLinkForm.value.url.trim()) return;
  const updates = { titulo: editingLinkForm.value.titulo.trim(), url: editingLinkForm.value.url.trim(), descripcion: editingLinkForm.value.descripcion.trim() || null };
  await supabase.from('links_cliente').update(updates).eq('id', l.id);
  Object.assign(l, updates);
  editingLinkId.value = null;
};

loadLinks();

// ── Visualizar informe detallado ───────────────────────────────────────────────
const selectedInforme = ref<InformeGuardado | null>(null);

const totalHorasDetalle = (inf: InformeGuardado) =>
  (inf.contenido?.tareas ?? []).reduce((s, t) => s + (t.horas ?? 0), 0);

const estadoColor: Record<string, string> = {
  'Completada': '#4ade80', 'En progreso': '#ffa500', 'Pendiente': '#888',
};

const showReportGenerator = ref(false);

// ── Histórico GMB ─────────────────────────────────────────────────────────────
const { snapshots: gmbSnapshots, refresh: refreshGmb } = useGmbHistorico(clientId);
const savingSnapshot = ref(false);

const generandoPDF = ref(false);
const generarPDF = () => {
  if (!clientData.value) return;
  generandoPDF.value = true;
  const periodo = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  try {
    generarInformeMensualPDF({
      cliente:   clientData.value,
      sedes:     sedes.value,
      proyectos: proyectos.value,
      facturas:  facturas.value,
      tickets:   [],
      periodo,
    });
  } finally {
    generandoPDF.value = false;
  }
};

const guardarSnapshot = async () => {
  savingSnapshot.value = true;
  try {
    await tomarSnapshot(sedes.value, clientId);
    await refreshGmb();
  } catch (e: any) {
    alert('Error al guardar snapshot: ' + (e.message ?? ''));
  } finally {
    savingSnapshot.value = false;
  }
};

// ── Health Score ──────────────────────────────────────────────────────────────
const clientHealth = computed(() => {
  if (!clientData.value) return 100;
  return computeHealthScore({
    facturas:  facturas.value,
    tickets:   [],
    proyectos: proyectos.value,
    sedes:     sedes.value,
    status:    clientData.value.status,
  });
});

// ── Utils ─────────────────────────────────────────────────────────────────────
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
</script>

<template>
  <div class="view-container">
    <div v-if="loading" class="loading-state">Cargando perfil...</div>

    <template v-else-if="clientData">
      <!-- Header del perfil -->
      <div class="profile-header">
        <div class="profile-identity">
          <div class="logo-container">
            <img v-if="clientData.logo" :src="clientData.logo" :alt="clientData.name" class="client-logo" @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
            <div v-else class="logo-placeholder">{{ clientData.name.charAt(0) }}</div>
          </div>
          <div class="header-info">
            <h1>{{ clientData.name }}</h1>
            <span class="client-contact">{{ clientData.contact }} · {{ clientData.industry }}</span>
            <span class="status-badge" :class="clientData.status.toLowerCase()">{{ clientData.status }}</span>
            <div class="health-badge" :style="{ background: healthColor(clientHealth) + '22', borderColor: healthColor(clientHealth) + '55', color: healthColor(clientHealth) }">
              <span class="health-score-num">{{ clientHealth }}</span>
              <span>/100 — Salud {{ healthLabel(clientHealth) }}</span>
            </div>
            <!-- Filtro de sede -->
            <div class="sede-filter">
              <label>📍 Sede:</label>
              <select v-model="selectedSedeId" class="custom-select">
                <option value="all">Todas las sedes</option>
                <option v-for="s in sedes" :key="s.id" :value="s.id">{{ s.nombre }}</option>
              </select>
              <button class="btn-sm btn-outline" @click="openNewSede">+ Añadir Sede</button>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
          <button class="btn-outline" @click="generarPDF" :disabled="generandoPDF">
            {{ generandoPDF ? '...' : '📄 Informe PDF' }}
          </button>
          <button class="btn-primary" @click="openEditModal">Editar Perfil</button>
        </div>
      </div>

      <!-- Panel de datos del cliente siempre visible -->
      <div class="client-data-panel">
        <div class="cdp-item" v-if="clientData.contactEmail">
          <span class="cdp-label">Email</span>
          <a :href="`mailto:${clientData.contactEmail}`" class="cdp-value link">{{ clientData.contactEmail }}</a>
        </div>
        <div class="cdp-item" v-if="clientData.telefono">
          <span class="cdp-label">Teléfono</span>
          <a :href="`tel:${clientData.telefono}`" class="cdp-value link">{{ clientData.telefono }}</a>
        </div>
        <div class="cdp-item" v-if="clientData.cif">
          <span class="cdp-label">CIF / NIF</span>
          <span class="cdp-value">{{ clientData.cif }}</span>
        </div>
        <div class="cdp-item" v-if="clientData.direccionFacturacion">
          <span class="cdp-label">Dirección facturación</span>
          <span class="cdp-value">{{ clientData.direccionFacturacion }}</span>
        </div>
        <template v-for="lead in leads.filter(l => l.link_canva)" :key="lead.id">
          <div class="cdp-item">
            <span class="cdp-label">Propuesta</span>
            <a :href="lead.link_canva" target="_blank" rel="noopener noreferrer" class="cdp-value link proposal-link">
              🔗 {{ lead.empresa || lead.nombre }}
            </a>
          </div>
        </template>
      </div>

      <div class="content-grid">
        <!-- COLUMNA IZQUIERDA -->
        <div class="grid-left">

          <!-- Resumen financiero (calculado desde facturas reales) -->
          <DashboardCard title="Resumen Financiero" v-if="selectedSedeId === 'all'">
            <div class="financials-flex">
              <div class="fin-box success">
                <span class="fin-label">Cobrado</span>
                <span class="fin-value">{{ financials.paid }}</span>
              </div>
              <div class="fin-box warning">
                <span class="fin-label">Pendiente</span>
                <span class="fin-value">{{ financials.pending }}</span>
              </div>
              <div class="fin-box neutral">
                <span class="fin-label">Total Facturado</span>
                <span class="fin-value">{{ financials.total }}</span>
              </div>
            </div>
            <!-- Lista de facturas del cliente -->
            <div v-if="facturas.length" class="facturas-list">
              <div v-for="f in facturas.slice(0, 5)" :key="f.id" class="factura-row">
                <span class="factura-concepto">{{ f.concepto }}</span>
                <div class="factura-right">
                  <span class="factura-importe">{{ f.importe.toLocaleString('es-ES') }} €</span>
                  <span class="factura-estado" :class="f.estado.toLowerCase()">{{ f.estado }}</span>
                </div>
              </div>
            </div>
            <p v-else class="empty-state">Sin facturas registradas</p>
          </DashboardCard>

          <!-- Cuentas asociadas -->
          <DashboardCard title="Cuentas Asociadas">
            <template #actions>
              <button class="btn-outline" @click="openNewCuenta">+ Añadir cuenta</button>
            </template>
            <div v-if="cuentas.length === 0" class="empty-state">Sin cuentas registradas</div>
            <ul v-else class="docs-list">
              <li v-for="c in cuentas" :key="c.id" class="doc-item">
                <div class="doc-info">
                  <span class="doc-icon">🔑</span>
                  <div class="doc-meta">
                    <span class="doc-name">{{ c.titulo }}</span>
                    <div class="cuenta-fields">
                      <span v-if="c.url" class="cuenta-field"><a :href="c.url" target="_blank" rel="noopener" class="link-url">{{ c.url }}</a></span>
                      <span class="cuenta-field"><span class="cuenta-label">Usuario:</span> {{ c.usuario || '—' }}</span>
                      <span class="cuenta-field"><span class="cuenta-label">Contraseña:</span> {{ c.password || '—' }}</span>
                    </div>
                  </div>
                </div>
                <div class="doc-actions">
                  <button class="btn-icon" title="Editar" @click="openEditCuenta(c)">✏️</button>
                  <button class="btn-icon delete" title="Eliminar" @click="confirmDeleteCuenta(c)">🗑️</button>
                </div>
              </li>
            </ul>
          </DashboardCard>

          <!-- Proyectos activos -->
          <DashboardCard title="Proyectos Activos">
            <div v-if="filteredProyectos.length === 0" class="empty-state">Sin proyectos para esta sede</div>
            <ul v-else class="activity-list">
              <li v-for="p in filteredProyectos" :key="p.id">
                <div class="act-dot" :style="{ backgroundColor: ESTADO_COLORS[p.estado] }"></div>
                <div class="act-text">
                  <strong>{{ p.nombre }}</strong>
                  <span>{{ p.fase || p.estado }}</span>
                </div>
                <span class="status-pill" :style="{ color: ESTADO_COLORS[p.estado], borderColor: ESTADO_COLORS[p.estado] }">
                  {{ p.estado }}
                </span>
              </li>
            </ul>
          </DashboardCard>

          <!-- Leads del cliente -->
          <DashboardCard title="Leads Comerciales" v-if="selectedSedeId === 'all'">
            <template #actions>
              <button class="btn-sm btn-outline" @click="goToCommercial">Ver en Comercial</button>
            </template>
            <div v-if="leads.length === 0" class="empty-state">Sin leads asociados</div>
            <ul v-else class="leads-list">
              <li v-for="l in leads" :key="l.id" class="lead-row" @click="goToCommercial">
                <div class="lead-dot" :style="{ backgroundColor: LEAD_ESTADO_COLORS[l.estado] }"></div>
                <div class="lead-info">
                  <strong class="lead-name">{{ l.nombre }}<span v-if="l.empresa" class="lead-empresa"> · {{ l.empresa }}</span></strong>
                  <div class="lead-meta">
                    <span v-if="l.servicio">{{ l.servicio }}</span>
                    <span v-if="l.fuente"> · {{ l.fuente }}</span>
                    <span> · {{ formatLeadDate(l.fecha_creacion) }}</span>
                  </div>
                </div>
                <div class="lead-right">
                  <span v-if="l.valor_estimado" class="lead-value">{{ formatLeadValue(l.valor_estimado) }}</span>
                  <span class="status-pill" :style="{ color: LEAD_ESTADO_COLORS[l.estado], borderColor: LEAD_ESTADO_COLORS[l.estado] }">
                    {{ l.estado }}
                  </span>
                </div>
              </li>
            </ul>
          </DashboardCard>

          <!-- Documentos -->
          <DashboardCard title="Gestor de Documentos">
            <div v-if="selectedSedeId === 'all'" class="upload-area upload-area--disabled">
              <div class="upload-icon">📁</div>
              <p>Selecciona una sede para subir documentos</p>
            </div>
            <div v-else class="upload-area" @click="triggerUpload" :class="{ uploading }">
              <input ref="fileInput" type="file" class="hidden-input" @change="handleFileChange" />
              <div class="upload-icon">{{ uploading ? '⏳' : '⬆️' }}</div>
              <p>{{ uploading ? 'Subiendo...' : 'Haz clic para subir un documento' }}</p>
              <span class="upload-hint">PDF, imágenes, ZIP — máx. 50 MB</span>
            </div>
            <p v-if="uploadError" class="error-msg">{{ uploadError }}</p>

            <div v-if="filteredDocumentos.length === 0" class="empty-state">{{ selectedSedeId === 'all' ? 'Sin documentos' : 'Sin documentos en esta sede' }}</div>
            <ul v-else class="docs-list">
              <li v-for="doc in filteredDocumentos" :key="doc.id" class="doc-item" :class="{ 'doc-item--editing': editingDocId === doc.id }">
                <div class="doc-info">
                  <span class="doc-icon">📄</span>
                  <div class="doc-meta">
                    <template v-if="editingDocId === doc.id">
                      <input v-model="editingDocNombre" class="inline-edit-input" @keyup.enter="saveDocNombre(doc)" @keyup.escape="cancelEditDoc" placeholder="Nombre del documento" />
                      <select v-model="editingDocSedeId" class="inline-edit-input">
                        <option :value="null">Sin sede</option>
                        <option v-for="s in sedes" :key="s.id" :value="s.id">{{ s.nombre }}</option>
                      </select>
                    </template>
                    <template v-else>
                      <span class="doc-name">{{ doc.nombre }}</span>
                    </template>
                    <span class="doc-details">{{ formatDate(doc.creado_en) }} · {{ doc.subido_por }} · {{ doc.tipo }}</span>
                  </div>
                </div>
                <div class="doc-actions">
                  <template v-if="editingDocId === doc.id">
                    <button class="btn-icon" title="Guardar" @click="saveDocNombre(doc)">✅</button>
                    <button class="btn-icon" title="Cancelar" @click="cancelEditDoc">❌</button>
                  </template>
                  <template v-else>
                    <button class="btn-icon" title="Editar nombre" @click="startEditDoc(doc)">✏️</button>
                    <button class="btn-icon" title="Descargar" @click="downloadDoc(doc.url, doc.nombre)">⬇️</button>
                    <button class="btn-icon delete" @click="confirmDeleteDoc(doc)" title="Eliminar">🗑️</button>
                  </template>
                </div>
              </li>
            </ul>
          </DashboardCard>

          <!-- Links de cliente -->
          <DashboardCard title="Links Compartidos">
            <template #actions>
              <button class="btn-outline" @click="showLinkForm = !showLinkForm">{{ showLinkForm ? 'Cancelar' : '+ Añadir link' }}</button>
            </template>

            <div v-if="showLinkForm" class="link-form">
              <input v-model="linkForm.titulo" class="form-input" placeholder="Título (ej: Carpeta Drive — Logos)" />
              <input v-model="linkForm.url" class="form-input" placeholder="URL (https://...)" type="url" />
              <input v-model="linkForm.descripcion" class="form-input" placeholder="Descripción opcional" />
              <button class="btn-primary" @click="saveLink" :disabled="savingLink">{{ savingLink ? 'Guardando...' : 'Guardar link' }}</button>
            </div>

            <div v-if="links.length === 0 && !showLinkForm" class="empty-state">Sin links compartidos</div>
            <ul v-else class="docs-list">
              <li v-for="l in links" :key="l.id" class="doc-item" :class="{ 'doc-item--editing': editingLinkId === l.id }">
                <div class="doc-info" style="flex:1;min-width:0;">
                  <span class="doc-icon">🔗</span>
                  <div class="doc-meta" style="flex:1;min-width:0;">
                    <template v-if="editingLinkId === l.id">
                      <input v-model="editingLinkForm.titulo" class="inline-edit-input" placeholder="Título" />
                      <input v-model="editingLinkForm.url" class="inline-edit-input" placeholder="URL" type="url" />
                      <input v-model="editingLinkForm.descripcion" class="inline-edit-input" placeholder="Descripción (opcional)" />
                    </template>
                    <template v-else>
                      <span class="doc-name">{{ l.titulo }}</span>
                      <span v-if="l.descripcion" class="doc-details">{{ l.descripcion }}</span>
                      <a :href="l.url" target="_blank" rel="noopener" class="link-url">{{ l.url }}</a>
                    </template>
                  </div>
                </div>
                <div class="doc-actions">
                  <template v-if="editingLinkId === l.id">
                    <button class="btn-icon" title="Guardar" @click="saveEditLink(l)">✅</button>
                    <button class="btn-icon" title="Cancelar" @click="cancelEditLink">❌</button>
                  </template>
                  <template v-else>
                    <button class="btn-icon" title="Editar" @click="startEditLink(l)">✏️</button>
                    <a :href="l.url" target="_blank" rel="noopener" class="btn-icon" title="Abrir">↗️</a>
                    <button class="btn-icon delete" @click="deleteLink(l.id)" title="Eliminar">🗑️</button>
                  </template>
                </div>
              </li>
            </ul>
          </DashboardCard>

          <!-- ─────────────────────────────────────────────────── -->
          <!-- GENERADOR DE INFORMES                               -->
          <!-- ─────────────────────────────────────────────────── -->
          <DashboardCard title="Generador de Informes de Trabajo">
            <template #actions>
              <button
                class="btn-action"
                @click="showReportGenerator = !showReportGenerator"
                :class="{ active: showReportGenerator }"
              >
                {{ showReportGenerator ? '✕ Cerrar' : '📋 Crear Informe' }}
              </button>
            </template>

            <Transition name="fade">
              <ClientReportGenerator
                v-if="showReportGenerator"
                :clienteId="clientId"
                :clienteNombre="clientData!.name"
                :clienteLogo="clientData!.logo || undefined"
                :clienteCif="clientData!.cif || undefined"
                :proyectoNombre="filteredProyectos[0]?.nombre"
              />
            </Transition>

            <div v-if="!showReportGenerator" class="report-cta">
              <div class="report-cta-icon">✨</div>
              <p class="report-cta-text">
                Describe el trabajo realizado para <strong>{{ clientData!.name }}</strong>, adjunta capturas
                de pantalla o imágenes de referencia y <strong>Gemini generará el informe completo
                automáticamente</strong> con la estética corporativa de Tane Solutions.
              </p>
              <div class="report-cta-tags">
                <span class="report-tag">✨ Redacción automática con IA</span>
                <span class="report-tag">🖼️ Análisis de imágenes</span>
                <span class="report-tag">📄 PDF con diseño Tane</span>
                <span class="report-tag">🗄️ Archivos del NAS</span>
              </div>
              <button class="btn-primary report-start-btn" @click="showReportGenerator = true">
                ✨ Generar Informe con IA →
              </button>
            </div>
          </DashboardCard>

        </div>

        <!-- COLUMNA DERECHA -->
        <div class="grid-right">
          <!-- Fichas Google My Business -->
          <div v-if="filteredSedes.length === 0" class="empty-state-card">
            <p>No hay sedes. <button class="btn-link" @click="openNewSede">Añade la primera sede</button></p>
          </div>
          <template v-else>
            <DashboardCard
              v-for="s in filteredSedes"
              :key="s.id"
              :title="`Sede: ${s.nombre}`"
              class="mb-2"
            >
              <template #actions>
                <div style="display:flex; gap:0.5rem">
                  <button class="btn-icon-text" @click="openEditSede(s)" title="Editar sede">✏️</button>
                  <button class="btn-icon-text danger" @click="confirmDeleteSede(s)" title="Eliminar">🗑️</button>
                </div>
              </template>
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
                <div class="gmb-stat" :class="{ urgent: s.gmb_unanswered > 0 }">
                  <span class="gmb-icon">{{ s.gmb_unanswered > 0 ? '⚠️' : '✅' }}</span>
                  <span class="gmb-val">{{ s.gmb_unanswered }}</span>
                  <span class="gmb-label">Sin responder</span>
                </div>
              </div>
              <div class="gmb-pub-card mt-1">
                <h4>Última publicación</h4>
                <p class="pub-text">"{{ s.gmb_latest_pub || 'Sin publicaciones' }}"</p>
                <div class="pub-footer">
                  <span>👁️ {{ s.gmb_pub_views }} visualizaciones</span>
                </div>
              </div>
            </DashboardCard>
          </template>

          <!-- Histórico GMB -->
          <DashboardCard title="Evolución GMB" v-if="selectedSedeId === 'all' && sedes.length > 0">
            <template #actions>
              <button class="btn-icon-text" @click="guardarSnapshot" :disabled="savingSnapshot">
                {{ savingSnapshot ? '...' : '📸 Guardar snapshot' }}
              </button>
            </template>
            <GmbChart :snapshots="gmbSnapshots" />
          </DashboardCard>

          <!-- Usuarios del cliente -->
          <DashboardCard title="Accesos (Usuarios del Cliente)" v-if="selectedSedeId === 'all'">
            <div v-if="usuarios.length === 0" class="empty-state">Sin usuarios vinculados</div>
            <ul v-else class="users-list">
              <li v-for="u in usuarios" :key="u.id" class="user-item">
                <div class="user-avatar">{{ u.nombre.charAt(0) }}</div>
                <div class="user-info">
                  <span class="user-name">{{ u.nombre }}</span>
                  <span class="user-role muted">{{ u.rol }}</span>
                </div>
              </li>
            </ul>
          </DashboardCard>
        </div>
      </div>

      <!-- Módulo de Informes (ancho completo) -->
      <ClientReportModule
        :client-id="clientId"
        :client-data="clientData ? { name: clientData.name, contact: clientData.contact, industry: clientData.industry } : null"
        :proyectos="proyectos"
        :is-admin="true"
      />
    </template>
    
    <!-- Modal: Detalle del Informe -->
    <div v-if="selectedInforme" class="modal-overlay report-detail-overlay">
      <div class="modal-box report-modal">
        <div class="report-modal-header">
          <div class="report-modal-title">
            <h2>{{ selectedInforme.titulo }}</h2>
            <p>{{ selectedInforme.proyecto }} · {{ selectedInforme.periodo || 'General' }}</p>
          </div>
          <button class="btn-close" @click="selectedInforme = null">✕</button>
        </div>

        <div class="report-modal-content scrollable">
          <div class="rg-preview-titulo">{{ selectedInforme.contenido?.tituloInforme || selectedInforme.titulo }}</div>

          <div class="report-section" v-if="selectedInforme.contenido?.descripcionGeneral">
            <label>DESCRIPCIÓN DEL PROYECTO</label>
            <p>{{ selectedInforme.contenido.descripcionGeneral }}</p>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.objetivos?.length">
            <label>OBJETIVOS</label>
            <ul class="client-steps-dots">
              <li v-for="o in selectedInforme.contenido.objetivos" :key="o">{{ o }}</li>
            </ul>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.resumenEjecutivo">
            <label>RESUMEN EJECUTIVO</label>
            <p class="resumen-text-box">{{ selectedInforme.contenido.resumenEjecutivo }}</p>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.kpis?.length">
            <label>RESULTADOS Y MÉTRICAS</label>
            <div class="client-kpi-grid">
              <div v-for="k in selectedInforme.contenido.kpis" :key="k.label" class="client-kpi-card">
                <span class="client-kpi-val">{{ k.value }}</span>
                <span class="client-kpi-label">{{ k.label }}</span>
              </div>
            </div>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.tareas?.length">
            <label>TRABAJOS REALIZADOS ({{ totalHorasDetalle(selectedInforme) }}h totales)</label>
            <div class="client-tareas-list">
              <div v-for="t in selectedInforme.contenido.tareas" :key="t.titulo" class="client-tarea-item">
                <div class="client-tarea-dot" :style="{ background: estadoColor[t.estado || 'Completada'] }"></div>
                <div class="client-tarea-text">
                  <strong>{{ t.titulo }}</strong>
                  <p>{{ t.descripcion }}</p>
                </div>
                <div class="client-tarea-hours" v-if="t.horas">{{ t.horas }}h</div>
              </div>
            </div>
          </div>

          <div class="report-section" v-if="selectedInforme.contenido?.imagenesAdjuntas?.length">
            <label>MATERIAL VISUAL ({{ selectedInforme.contenido.imagenesAdjuntas.length }} imágenes)</label>
            <div class="client-gallery">
              <img v-for="img in selectedInforme.contenido.imagenesAdjuntas" :key="img.nombre" :src="img.base64" :alt="img.nombre" />
            </div>
          </div>

          <div class="report-double-grid">
            <div class="report-section" v-if="selectedInforme.contenido?.conclusiones">
              <label>CONCLUSIONES</label>
              <p>{{ selectedInforme.contenido.conclusiones }}</p>
            </div>
            <div class="report-section" v-if="selectedInforme.contenido?.proximosPasos?.length">
              <label>PRÓXIMOS PASOS</label>
              <ol class="client-steps-ordered">
                <li v-for="step in selectedInforme.contenido.proximosPasos" :key="step">{{ step }}</li>
              </ol>
            </div>
          </div>

          <!-- Adjuntos -->
          <div class="report-section" v-if="selectedInforme.adjuntos?.length">
            <label>ARCHIVOS ADJUNTOS</label>
            <div class="adjuntos-modal-list">
              <a
                v-for="adj in selectedInforme.adjuntos"
                :key="adj.id"
                :href="adj.url"
                target="_blank"
                rel="noopener noreferrer"
                class="adjunto-modal-item"
              >
                <span>{{ adj.tipo === 'pdf' ? '📄' : adj.tipo === 'image' ? '🖼️' : '📎' }}</span>
                <span class="adjunto-nombre">{{ adj.nombre }}</span>
                <span v-if="adj.tamanio" class="adjunto-size">{{ (adj.tamanio / 1024).toFixed(0) }} KB</span>
              </a>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <a :href="selectedInforme.url_pdf" target="_blank" class="btn-primary">📄 Descargar PDF</a>
          <button class="btn-text" @click="selectedInforme = null">Cerrar</button>
        </div>
      </div>
    </div>

    <div v-if="!loading && !clientData" class="loading-state">Cliente no encontrado.</div>

    <!-- Modal: Cuenta asociada -->
    <div class="modal-overlay" v-if="showCuentaModal">
      <div class="modal-box">
        <p class="modal-title">{{ editingCuentaId ? 'Editar Cuenta' : 'Nueva Cuenta' }}</p>
        <div class="form-group"><label>Título *</label><input v-model="cuentaForm.titulo" class="form-input" placeholder="Ej: Instagram, Gmail, cPanel..." /></div>
        <div class="form-group"><label>URL</label><input v-model="cuentaForm.url" class="form-input" type="url" placeholder="https://..." /></div>
        <div class="form-row">
          <div class="form-group"><label>Usuario</label><input v-model="cuentaForm.usuario" class="form-input" placeholder="usuario@ejemplo.com" /></div>
          <div class="form-group">
            <label>Contraseña</label>
            <div class="pass-input-wrap">
              <input v-model="cuentaForm.password" :type="showCuentaPass ? 'text' : 'password'" class="form-input" placeholder="••••••••" />
              <button type="button" class="pass-toggle" @click="showCuentaPass = !showCuentaPass">{{ showCuentaPass ? '🙈' : '👁️' }}</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showCuentaModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveCuenta" :disabled="savingCuenta || !cuentaForm.titulo.trim()">{{ savingCuenta ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>
    </div>

    <!-- Modal: Editar perfil -->
    <div class="modal-overlay" v-if="showEditModal">
      <div class="modal-box">
        <p class="modal-title">Editar Perfil del Cliente</p>
        <div class="form-group"><label>Nombre *</label><input v-model="editForm.name" class="form-input" /></div>
        <div class="form-row">
          <div class="form-group"><label>Contacto</label><input v-model="editForm.contact" class="form-input" /></div>
          <div class="form-group"><label>Teléfono</label><input v-model="editForm.telefono" class="form-input" type="tel" placeholder="+34 600 000 000" /></div>
        </div>
        <div class="form-group"><label>Email de contacto</label><input v-model="editForm.contactEmail" class="form-input" type="email" placeholder="cliente@ejemplo.com" /></div>
        <div class="form-group"><label>Industria / Sector</label><input v-model="editForm.industry" class="form-input" /></div>
        <div class="form-group"><label>CIF / NIF</label><input v-model="editForm.cif" class="form-input" placeholder="B-12345678" /></div>
        <div class="form-group"><label>Dirección de facturación</label><input v-model="editForm.direccionFacturacion" class="form-input" placeholder="Calle Ejemplo, 1, 28001 Madrid" /></div>
        <div class="form-group"><label>URL Logo</label><input v-model="editForm.logo" class="form-input" /></div>
        <div class="form-group">
          <label>Estado</label>
          <select v-model="editForm.status" class="form-input">
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-text" @click="showEditModal = false">Cancelar</button>
          <button class="btn-primary" @click="handleSaveProfile" :disabled="savingProfile">
            {{ savingProfile ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Añadir / Editar sede -->
    <div class="modal-overlay" v-if="showSedeModal">
      <div class="modal-box">
        <p class="modal-title">{{ editingSedeId !== null ? 'Editar Sede' : 'Añadir Sede' }}</p>
        <div class="form-group"><label>Nombre de la sede *</label><input v-model="sedeForm.nombre" class="form-input" /></div>
        <div class="form-row">
          <div class="form-group">
            <label>Calificación GMB (0–5)</label>
            <input v-model.number="sedeForm.gmb_rating" type="number" min="0" max="5" step="0.1" class="form-input" />
          </div>
          <div class="form-group">
            <label>Total reseñas</label>
            <input v-model.number="sedeForm.gmb_reviews" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <label>Sin responder</label>
            <input v-model.number="sedeForm.gmb_unanswered" type="number" min="0" class="form-input" />
          </div>
        </div>
        <div class="form-group"><label>Última publicación</label><input v-model="sedeForm.gmb_latest_pub" class="form-input" /></div>
        <div class="form-group"><label>Visualizaciones publicación</label><input v-model.number="sedeForm.gmb_pub_views" type="number" min="0" class="form-input" /></div>
        <div class="modal-actions">
          <button class="btn-text" @click="showSedeModal = false">Cancelar</button>
          <button class="btn-primary" @click="saveSede" :disabled="savingSede || !sedeForm.nombre">
            {{ savingSede ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container { display: flex; flex-direction: column; gap: 2rem; }

/* Panel de datos del cliente */
.client-data-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
.cdp-item { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.85rem; }
.cdp-label { color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
.cdp-value { color: var(--color-text-light); }
.cdp-value.link { color: var(--color-primary); text-decoration: underline; text-underline-offset: 3px; }
.cdp-value.link:hover { color: var(--color-primary-hover); }
.proposal-link { font-weight: 600; }

/* Report CTA (collapsed state) */
.report-cta { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
.report-cta-icon { font-size: 2rem; }
.report-cta-text { margin: 0; font-size: 0.9rem; color: var(--color-text-muted); line-height: 1.6; }
.report-cta-text strong { color: var(--color-text-light); }
.report-cta-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.report-tag { font-size: 0.76rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 8px; background: rgba(227,255,4,0.08); color: var(--color-primary); border: 1px solid rgba(227,255,4,0.2); }
.report-nas-config { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 0.4rem; }
.nas-label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.nas-hint { font-weight: 400; font-size: 0.75rem; }
.report-start-btn { margin-top: 0.25rem; }

/* btn-action active state */
.btn-action.active { border-color: var(--color-primary); color: var(--color-primary); }

/* Transition */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-6px); }
.loading-state { color: var(--color-text-muted); font-style: italic; padding: 2rem 0; }

.profile-header { display: flex; justify-content: space-between; align-items: center; background: var(--color-bg-card); padding: 2rem; border-radius: 12px; border: 1px solid var(--color-border); flex-wrap: wrap; gap: 1.5rem; }
.profile-identity { display: flex; gap: 1.5rem; align-items: center; }
.logo-container { width: 80px; height: 80px; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
.client-logo { width: 100%; height: 100%; object-fit: cover; }
.logo-placeholder { width: 80px; height: 80px; background: var(--color-primary); color: #000; font-size: 2rem; font-weight: 800; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
.header-info { display: flex; flex-direction: column; gap: 0.3rem; }
.header-info h1 { font-size: 1.8rem; margin: 0; }
.client-contact { color: var(--color-text-muted); }
.status-badge { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 700; display: inline-block; }
.status-badge.activo { background: rgba(74,222,128,0.2); color: #4ade80; }
.status-badge.inactivo { background: rgba(248,113,113,0.2); color: #f87171; }

.health-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 0.25rem 0.75rem; border-radius: 20px; border: 1px solid;
  font-size: 0.82rem; font-weight: 600; margin-top: 4px;
}
.health-score-num { font-size: 1rem; font-weight: 800; }
.sede-filter { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
.sede-filter label { font-size: 0.9rem; font-weight: 600; color: var(--color-text-muted); }
.custom-select { background: rgba(255,255,255,0.05); color: var(--color-text-light); border: 1px solid var(--color-border); padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.9rem; outline: none; color-scheme: dark; }
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px; cursor: pointer; }
.btn-outline { background: transparent; border: 1px dashed var(--color-text-muted); color: var(--color-text-muted); }
.btn-outline:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn-primary { background: var(--color-primary); color: #000; font-weight: 700; padding: 0.6rem 1.2rem; border: none; border-radius: 6px; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
.grid-left, .grid-right { display: flex; flex-direction: column; gap: 1.5rem; }

/* Financials */
.financials-flex { display: flex; gap: 1rem; margin-bottom: 1rem; }
.fin-box { flex: 1; background: var(--color-bg-lighter); padding: 1rem; border-radius: 8px; display: flex; flex-direction: column; align-items: center; text-align: center; border: 1px solid transparent; }
.fin-box.success { border-color: rgba(74,222,128,0.3); color: #4ade80; }
.fin-box.warning { border-color: rgba(250,204,21,0.3); color: #facc15; }
.fin-box.neutral { border-color: var(--color-border); color: var(--color-text-light); }
.fin-label { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.4rem; }
.fin-value { font-size: 1.3rem; font-weight: 700; }

.facturas-list { display: flex; flex-direction: column; gap: 0.4rem; }
.factura-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.88rem; }
.factura-concepto { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.factura-right { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
.factura-importe { font-weight: 700; }
.factura-estado { font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 8px; }
.factura-estado.pagada { background: rgba(74,222,128,0.15); color: #4ade80; }
.factura-estado.pendiente { background: rgba(255,165,0,0.15); color: #ffa500; }
.factura-estado.vencida { background: rgba(255,68,68,0.15); color: #ff4444; }

/* Projects */
.activity-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.activity-list li { display: flex; gap: 0.75rem; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius: 8px; border-left: 2px solid transparent; }
.act-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.act-text { display: flex; flex-direction: column; flex: 1; }
.act-text strong { font-size: 0.95rem; }
.act-text span { font-size: 0.8rem; color: var(--color-text-muted); }
.status-pill { font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 10px; border: 1px solid; flex-shrink: 0; }

/* Leads */
.leads-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; margin: 0; }
.lead-row { display: flex; gap: 0.75rem; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius: 8px; cursor: pointer; transition: background 0.15s, border-color 0.15s; border: 1px solid transparent; }
.lead-row:hover { background: rgba(227,255,4,0.04); border-color: var(--color-border); }
.lead-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.lead-info { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 2px; }
.lead-name { font-size: 0.92rem; font-weight: 600; color: var(--color-text-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lead-empresa { color: var(--color-text-muted); font-weight: 500; }
.lead-meta { font-size: 0.75rem; color: var(--color-text-muted); display: flex; flex-wrap: wrap; }
.lead-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.lead-value { font-size: 0.82rem; font-weight: 700; color: var(--color-text-light); white-space: nowrap; }

/* Docs */
.upload-area { border: 2px dashed var(--color-border); padding: 1.5rem; text-align: center; border-radius: 8px; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s; }
.upload-area:hover, .upload-area.uploading { border-color: var(--color-primary); background: rgba(227,255,4,0.03); }
.upload-area--disabled { cursor: default; opacity: 0.5; }
.upload-area--disabled:hover { border-color: var(--color-border); background: none; }
.link-form { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; padding: 1rem; background: var(--color-bg-lighter); border-radius: 8px; border: 1px solid var(--color-border); }
.link-url { font-size: 0.78rem; color: var(--color-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
.hidden-input { display: none; }
.upload-icon { font-size: 1.8rem; margin-bottom: 0.3rem; }
.upload-hint { font-size: 0.8rem; color: var(--color-text-muted); display: block; margin-top: 0.3rem; }
.error-msg { color: #ff4444; font-size: 0.85rem; margin-bottom: 0.75rem; }
.docs-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.docs-warning { font-size: 0.82rem; color: #f59e0b; margin: 0 0 0.75rem; }
.inline-edit-input { background: var(--color-bg-dark); color: var(--color-text-light); border: 1px solid var(--color-primary); border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.88rem; width: 100%; margin-bottom: 0.25rem; }
.doc-item--editing { align-items: flex-start; }
.informe-item { display: flex; flex-direction: column; gap: 0; }
.doc-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--color-bg-lighter); border-radius: 8px; }
.informe-item .doc-item { border-radius: 8px 8px 0 0; }
.informe-adjuntos { background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-top: none; border-radius: 0 0 8px 8px; padding: 0.4rem 0.75rem; display: flex; flex-direction: column; gap: 0.3rem; }
.adjunto-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.adjunto-link { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--color-text-muted); flex: 1; min-width: 0; overflow: hidden; text-decoration: none; }
.adjunto-link:hover { color: var(--color-primary); }
.adjunto-nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adjunto-size { font-size: 0.72rem; color: var(--color-text-muted); white-space: nowrap; flex-shrink: 0; }
.adjunto-icon { flex-shrink: 0; }
.adjuntos-modal-list { display: flex; flex-direction: column; gap: 0.4rem; }
.adjunto-modal-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid var(--color-border); border-radius: 6px; color: var(--color-text-light); text-decoration: none; font-size: 0.88rem; transition: border-color 0.2s; }
.adjunto-modal-item:hover { border-color: var(--color-primary); color: var(--color-primary); }
.doc-info { display: flex; gap: 0.75rem; align-items: center; overflow: hidden; }
.doc-icon { font-size: 1.3rem; flex-shrink: 0; }
.doc-meta { display: flex; flex-direction: column; overflow: hidden; }
.doc-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-details { font-size: 0.78rem; color: var(--color-text-muted); }
.cuenta-fields { display: flex; flex-direction: column; gap: 0.15rem; margin-top: 0.2rem; }
.cuenta-field { font-size: 0.78rem; color: var(--color-text-muted); }
.cuenta-label { font-weight: 600; color: var(--color-text-muted); }
.link-url { font-size: 0.78rem; color: var(--color-primary); text-decoration: underline; word-break: break-all; }
.pass-input-wrap { position: relative; display: flex; align-items: center; }
.pass-input-wrap .form-input { padding-right: 2.5rem; flex: 1; }
.pass-toggle { position: absolute; right: 0.6rem; background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0; }
.doc-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.btn-icon { background: rgba(255,255,255,0.08); padding: 0.4rem; border-radius: 4px; border: none; cursor: pointer; text-decoration: none; font-size: 1rem; }
.btn-icon:hover { background: rgba(255,255,255,0.18); }
.btn-icon.delete:hover { background: rgba(248,113,113,0.2); }

/* GMB */
.gmb-stats { display: flex; gap: 1rem; margin-bottom: 1rem; }
.gmb-stat { flex: 1; display: flex; flex-direction: column; align-items: center; background: var(--color-bg-lighter); padding: 1rem; border-radius: 8px; }
.gmb-stat.urgent { border: 1px solid rgba(248,113,113,0.5); }
.gmb-icon { font-size: 1.3rem; margin-bottom: 0.2rem; }
.gmb-val { font-size: 1.4rem; font-weight: 700; }
.gmb-label { font-size: 0.78rem; color: var(--color-text-muted); text-align: center; }
.gmb-pub-card { background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--color-primary); }
.gmb-pub-card h4 { margin: 0 0 0.4rem; font-size: 0.85rem; color: var(--color-text-muted); }
.pub-text { font-style: italic; margin: 0 0 0.5rem; }
.pub-footer { font-size: 0.82rem; color: var(--color-text-muted); }
.mt-1 { margin-top: 1rem; }
.mb-2 { margin-bottom: 1.5rem; }

/* Users */
.users-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.user-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: var(--color-bg-lighter); border-radius: 8px; }
.user-avatar { width: 36px; height: 36px; background: var(--color-primary); color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; }
.user-info { display: flex; flex-direction: column; }
.user-name { font-weight: 600; font-size: 0.95rem; }
.user-role { font-size: 0.8rem; }
.muted { color: var(--color-text-muted); }

.empty-state { color: var(--color-text-muted); font-style: italic; text-align: center; padding: 1.5rem; }
.empty-state-card { background: var(--color-bg-card); border: 1px dashed var(--color-border); border-radius: 12px; padding: 2rem; text-align: center; }
.btn-link { background: none; border: none; color: var(--color-primary); cursor: pointer; text-decoration: underline; font-size: inherit; }

.btn-icon-text { background: transparent; border: none; cursor: pointer; font-size: 0.9rem; padding: 0.2rem; border-radius: 4px; }
.btn-icon-text:hover { background: rgba(255,255,255,0.1); }
.btn-icon-text.danger:hover { background: rgba(248,113,113,0.15); }

/* Modals */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem 2.25rem; width: 90%; max-width: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.9rem 1.1rem; border-radius: 6px; font-family: inherit; font-size: 1rem; outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; }
.form-input:focus { border-color: var(--color-primary); }
.btn-text { background: transparent; border: none; color: var(--color-primary); cursor: pointer; font-size: 0.9rem; }

@media (max-width: 600px) {
  .profile-header { padding: 1.5rem; flex-direction: column; align-items: flex-start; text-align: center; }
  .profile-identity { flex-direction: column; align-items: center; width: 100%; }
  .header-info { align-items: center; }
  .sede-filter { justify-content: center; width: 100%; }
  .financials-flex { flex-direction: column; }
  .factura-row { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
  .factura-right { width: 100%; justify-content: space-between; }
  .doc-item { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .doc-actions { width: 100%; justify-content: flex-end; }
  .gmb-stats { flex-direction: column; }
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

@media (max-width: 800px) {
  .report-double-grid { grid-template-columns: 1fr; }
  .report-modal-content { padding: 1.5rem; gap: 1.75rem; }
}
</style>
