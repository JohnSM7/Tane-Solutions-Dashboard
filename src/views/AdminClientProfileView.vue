<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import DashboardCard from '../components/DashboardCard.vue';
import ClientReportModule from '../components/ClientReportModule.vue';
import { useClientProfile, type Sede } from '../services/clients';
import { ESTADO_COLORS } from '../services/operations';

const route = useRoute();
const clientId = route.params.id as string;
const {
  clientData, facturas, proyectos, sedes, documentos, usuarios,
  financials, loading,
  saveProfile, addSede, updateSede, deleteSede,
  uploadDocumento, deleteDocumento,
} = useClientProfile(clientId);

// ── Filtro de sede ────────────────────────────────────────────────────────────
const selectedSedeId = ref<number | 'all'>('all');

const filteredProyectos = computed(() => {
  if (!proyectos.value.length) return [];
  if (selectedSedeId.value === 'all') return proyectos.value;
  return proyectos.value.filter((p: any) => p.sede_id === selectedSedeId.value);
});

const filteredDocumentos = computed(() => {
  if (!documentos.value.length) return [];
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
const editForm = ref({ name: '', contact: '', industry: '', logo: '', status: '', cif: '', direccionFacturacion: '' });
const savingProfile = ref(false);

const openEditModal = () => {
  if (!clientData.value) return;
  editForm.value = {
    name: clientData.value.name,
    contact: clientData.value.contact,
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
  await saveProfile(editForm.value);
  savingProfile.value = false;
  showEditModal.value = false;
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
  } finally { savingSede.value = false; }
};

const confirmDeleteSede = async (s: Sede) => {
  if (!confirm(`¿Eliminar la sede "${s.nombre}"? Se eliminarán también sus documentos y proyectos asociados.`)) return;
  await deleteSede(s.id);
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
        <button class="btn-primary" @click="openEditModal">Editar Perfil</button>
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

          <!-- Documentos -->
          <DashboardCard title="Gestor de Documentos">
            <div class="upload-area" @click="triggerUpload" :class="{ uploading }">
              <input ref="fileInput" type="file" class="hidden-input" @change="handleFileChange" />
              <div class="upload-icon">{{ uploading ? '⏳' : '⬆️' }}</div>
              <p>{{ uploading ? 'Subiendo...' : 'Haz clic para subir un documento' }}</p>
              <span class="upload-hint">PDF, imágenes, ZIP — máx. 50 MB</span>
            </div>
            <p v-if="uploadError" class="error-msg">{{ uploadError }}</p>

            <div v-if="filteredDocumentos.length === 0" class="empty-state">Sin documentos</div>
            <ul v-else class="docs-list">
              <li v-for="doc in filteredDocumentos" :key="doc.id" class="doc-item">
                <div class="doc-info">
                  <span class="doc-icon">📄</span>
                  <div class="doc-meta">
                    <span class="doc-name">{{ doc.nombre }}</span>
                    <span class="doc-details">{{ formatDate(doc.creado_en) }} · {{ doc.subido_por }} · {{ doc.tipo }}</span>
                  </div>
                </div>
                <div class="doc-actions">
                  <a :href="doc.url" target="_blank" class="btn-icon" title="Ver/Descargar">⬇️</a>
                  <button class="btn-icon delete" @click="confirmDeleteDoc(doc)" title="Eliminar">🗑️</button>
                </div>
              </li>
            </ul>
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

    <div v-else class="loading-state">Cliente no encontrado.</div>

    <!-- Modal: Editar perfil -->
    <div class="modal-overlay" v-if="showEditModal" @click.self="showEditModal = false">
      <div class="modal-box">
        <p class="modal-title">Editar Perfil del Cliente</p>
        <div class="form-group"><label>Nombre *</label><input v-model="editForm.name" class="form-input" /></div>
        <div class="form-group"><label>Contacto</label><input v-model="editForm.contact" class="form-input" /></div>
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
    <div class="modal-overlay" v-if="showSedeModal" @click.self="showSedeModal = false">
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

/* Docs */
.upload-area { border: 2px dashed var(--color-border); padding: 1.5rem; text-align: center; border-radius: 8px; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s; }
.upload-area:hover, .upload-area.uploading { border-color: var(--color-primary); background: rgba(227,255,4,0.03); }
.hidden-input { display: none; }
.upload-icon { font-size: 1.8rem; margin-bottom: 0.3rem; }
.upload-hint { font-size: 0.8rem; color: var(--color-text-muted); display: block; margin-top: 0.3rem; }
.error-msg { color: #ff4444; font-size: 0.85rem; margin-bottom: 0.75rem; }
.docs-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.doc-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--color-bg-lighter); border-radius: 8px; }
.doc-info { display: flex; gap: 0.75rem; align-items: center; overflow: hidden; }
.doc-icon { font-size: 1.3rem; flex-shrink: 0; }
.doc-meta { display: flex; flex-direction: column; overflow: hidden; }
.doc-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-details { font-size: 0.78rem; color: var(--color-text-muted); }
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
.modal-box { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 2rem; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto; }
.modal-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 1.5rem; color: var(--color-text-light); }
.modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border); }
.form-row { display: flex; gap: 0.75rem; }
.form-row .form-group { flex: 1; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted); }
.form-input { background: var(--color-bg-lighter); border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.7rem 1rem; border-radius: 6px; font-family: inherit; font-size: 0.95rem; outline: none; width: 100%; box-sizing: border-box; color-scheme: dark; }
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
</style>
