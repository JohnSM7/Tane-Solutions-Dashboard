<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { generateInformeConIA, fileToAIImage, type AIImageInput } from '../services/aiReport';
import { guardarInforme, descargarReportePDF, NAS_FILE_ICONS, detectarTipoArchivo, type InformeProyecto, type ArchivoNAS, type ImagenAdjunta, type InformeGuardado } from '../services/reportes';

const props = defineProps<{
  clienteNombre: string;
  clienteId: string;
  clienteLogo?: string;
  clienteCif?: string;
  proyectoNombre?: string;
}>();

const emit = defineEmits(['generado']);

// ── Estado general ─────────────────────────────────────────────────────────────
type Mode = 'ai' | 'result';
const mode = ref<Mode>('ai');
const generando = ref(false);
const generandoPDF = ref(false);
const error = ref('');

// ── Paso AI: prompt + imágenes ────────────────────────────────────────────────
const prompt = ref('');
const imageFiles = ref<File[]>([]);
const imageInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const addImages = (files: FileList | null) => {
  if (!files) return;
  const allowed = Array.from(files).filter(f => f.type.startsWith('image/'));
  imageFiles.value.push(...allowed);
};
const removeImage = (i: number) => imageFiles.value.splice(i, 1);
const onDrop = (e: DragEvent) => { isDragging.value = false; addImages(e.dataTransfer?.files ?? null); };

// ── Resultado IA ──────────────────────────────────────────────────────────────
const informe = ref<Partial<InformeProyecto>>({});
const suggestions = ref<string[]>([]);

// Archivos NAS (añadidos en el paso de resultado)
const archivos = ref<ArchivoNAS[]>([]);
const archivoForm = ref({ nombre: '', url: '', descripcion: '' });
const addArchivo = () => {
  if (!archivoForm.value.nombre || !archivoForm.value.url) return;
  archivos.value.push({ ...archivoForm.value, tipo: detectarTipoArchivo(archivoForm.value.nombre) });
  archivoForm.value = { nombre: '', url: '', descripcion: '' };
};
const removeArchivo = (i: number) => archivos.value.splice(i, 1);

// Preview de imágenes
const imagePreviews = computed(() =>
  imageFiles.value.map(f => URL.createObjectURL(f))
);

// ── Generar con IA ────────────────────────────────────────────────────────────
const generarConIA = async () => {
  error.value = '';
  if (!prompt.value.trim()) { error.value = 'Escribe una descripción del trabajo realizado.'; return; }
  generando.value = true;
  try {
    const imgs: AIImageInput[] = await Promise.all(imageFiles.value.map(fileToAIImage));
    const result = await generateInformeConIA(prompt.value, props.clienteNombre, imgs, props.proyectoNombre);
    informe.value = { ...result.informe, clienteNombre: props.clienteNombre, clienteLogo: props.clienteLogo, clienteCif: props.clienteCif };
    suggestions.value = result.suggestions;
    mode.value = 'result';
  } catch (e: any) {
    error.value = e?.message ?? 'Error al conectar con la IA. Verifica tu API key de Gemini.';
  } finally {
    generando.value = false;
  }
};

// ── Informes guardados ───────────────────────────────────────────────────────
const informesGuardados = ref<InformeGuardado[]>([]);
const cargandoHistorico = ref(true);

onMounted(async () => {
  // Ya no cargamos aquí, el padre gestiona la lista
  cargandoHistorico.value = false;
});

// ── Generar PDF (guardar en Supabase + descargar) ────────────────────────────
const descargarPDF = async () => {
  generandoPDF.value = true;
  try {
    const adjuntas: ImagenAdjunta[] = [];
    for (const file of imageFiles.value) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      adjuntas.push({ base64: dataUrl, nombre: file.name });
    }
    const informeCompleto = { ...(informe.value as InformeProyecto), archivosNas: archivos.value, imagenesAdjuntas: adjuntas };

    try {
      const guardado = await guardarInforme(informeCompleto, props.clienteId);
      informesGuardados.value = [guardado, ...informesGuardados.value];
      emit('generado', guardado); // Avisar al padre
    } catch (err: any) {
      console.error('[Informe] Error crítico:', err);
      alert('Error al guardar el informe en la plataforma: ' + err.message + '. El PDF se descargará de todas formas.');
      await descargarReportePDF(informeCompleto);
    }
  } finally {
    generandoPDF.value = false;
  }
};

const totalHoras = computed(() =>
  (informe.value.tareas ?? []).reduce((s, t) => s + (t.horas ?? 0), 0)
);

const estadoColor: Record<string, string> = {
  'Completada': '#4ade80', 'En progreso': '#ffa500', 'Pendiente': '#888',
};
</script>

<template>
  <div class="rg">
    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- MODO: PROMPT + IMÁGENES (IA)                              -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div v-if="mode === 'ai'" class="rg-ai-panel">

      <!-- Cabecera -->
      <div class="rg-ai-header">
        <div class="rg-ai-badge">✨ IA</div>
        <div>
          <h3 class="rg-ai-title">Generar Informe con Inteligencia Artificial</h3>
          <p class="rg-ai-sub">Describe el trabajo realizado y adjunta imágenes. Gemini redactará el informe completo con la estética de Tane Solutions.</p>
        </div>
      </div>

      <!-- Prompt -->
      <div class="rg-field">
        <label class="rg-label">
          📝 Descripción del trabajo realizado
          <span class="rg-hint">Cuánto más detallado, mejor será el informe generado</span>
        </label>
        <textarea
          v-model="prompt"
          class="rg-textarea"
          rows="6"
          placeholder="Ejemplo: Hemos realizado el rediseño completo de la identidad visual para Restaurante El Olivo. Creamos un nuevo logotipo, paleta de colores, tipografía, diseño de menú, tarjetas de visita y plantillas para redes sociales. El cliente quedó muy satisfecho con el resultado. También optimizamos su perfil de Google My Business que pasó de 3.8 a 4.6 estrellas tras responder a 47 reseñas pendientes..."
        />
      </div>

      <!-- Drop zone de imágenes -->
      <div class="rg-field">
        <label class="rg-label">
          🖼️ Material de referencia
          <span class="rg-hint">Capturas de pantalla, estadísticas, mockups, antes/después… (opcional)</span>
        </label>

        <div
          class="rg-dropzone"
          :class="{ 'rg-dropzone--active': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="onDrop"
          @click="imageInputRef?.click()"
        >
          <input ref="imageInputRef" type="file" accept="image/*" multiple class="rg-hidden" @change="addImages(($event.target as HTMLInputElement).files)" />
          <div class="rg-dropzone-inner">
            <span class="rg-dropzone-icon">{{ isDragging ? '📂' : '⬆️' }}</span>
            <p>Arrastra imágenes aquí o <strong>haz clic para seleccionar</strong></p>
            <small>PNG, JPG, WebP — sin límite de cantidad</small>
          </div>
        </div>

        <!-- Preview de imágenes -->
        <div v-if="imageFiles.length > 0" class="rg-images-grid">
          <div v-for="(src, i) in imagePreviews" :key="i" class="rg-img-thumb">
            <img :src="src" :alt="imageFiles[i]?.name" />
            <button class="rg-img-remove" @click.stop="removeImage(i)" title="Quitar">✕</button>
            <span class="rg-img-name">{{ imageFiles[i]?.name }}</span>
          </div>
        </div>
      </div>

      <!-- Error -->
      <p v-if="error" class="rg-error">⚠️ {{ error }}</p>

      <!-- Botón generar -->
      <button
        class="rg-btn-generate"
        @click="generarConIA"
        :disabled="generando || !prompt.trim()"
      >
        <span v-if="generando" class="rg-generating-anim">
          <span></span><span></span><span></span>
        </span>
        <span v-else>✨</span>
        {{ generando ? 'Gemini está redactando el informe…' : 'Generar Informe con IA' }}
      </button>

      <p v-if="generando" class="rg-generating-hint">
        Analizando {{ imageFiles.length > 0 ? `${imageFiles.length} imagen(es) y el` : 'el' }} briefing…
        Esto puede tardar entre 10 y 30 segundos.
      </p>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- MODO: RESULTADO IA + EDICIÓN + PDF                        -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div v-else-if="mode === 'result'" class="rg-result">

      <!-- Barra de acciones superior -->
      <div class="rg-result-bar">
        <button class="rg-btn-back" @click="mode = 'ai'">← Regenerar</button>
        <div class="rg-result-bar-right">
          <span class="rg-success-badge">✓ Informe generado por IA</span>
          <button class="rg-btn-pdf" @click="descargarPDF" :disabled="generandoPDF">
            {{ generandoPDF ? '⏳ Generando PDF…' : '📄 Descargar PDF' }}
          </button>
        </div>
      </div>

      <!-- Sugerencias de la IA -->
      <div v-if="suggestions.length > 0" class="rg-suggestions">
        <p class="rg-suggestions-title">💡 Sugerencias de Gemini para este cliente:</p>
        <ul>
          <li v-for="s in suggestions" :key="s">{{ s }}</li>
        </ul>
      </div>

      <!-- Preview del informe -->
      <div class="rg-preview-card">

        <!-- Cabecera estilo PDF -->
        <div class="rg-preview-header">
          <div class="rg-preview-agency">
            <div class="rg-preview-logo">T</div>
            <div><strong>TANE SOLUTIONS S.L.</strong><span>www.tanesolutions.com</span></div>
          </div>
          <div class="rg-preview-tag">INFORME<br/><small>de Trabajo</small></div>
        </div>

        <!-- Cliente + Meta -->
        <div class="rg-preview-meta-row">
          <div>
            <small>CLIENTE</small>
            <strong>{{ clienteNombre }}</strong>
            <span v-if="clienteCif">{{ clienteCif }}</span>
          </div>
          <div>
            <small>PROYECTO</small>
            <strong>{{ informe.proyectoNombre }}</strong>
            <span v-if="informe.periodo">{{ informe.periodo }}</span>
          </div>
        </div>

        <!-- Título del informe -->
        <div class="rg-preview-titulo">{{ informe.tituloInforme }}</div>

        <!-- Descripción -->
        <div v-if="informe.descripcionGeneral" class="rg-preview-section">
          <label>DESCRIPCIÓN DEL PROYECTO</label>
          <p>{{ informe.descripcionGeneral }}</p>
        </div>

        <!-- Objetivos -->
        <div v-if="informe.objetivos && informe.objetivos.length > 0" class="rg-preview-section">
          <label>OBJETIVOS</label>
          <ul class="rg-obj-list">
            <li v-for="o in informe.objetivos" :key="o">{{ o }}</li>
          </ul>
        </div>

        <!-- Resumen ejecutivo -->
        <div v-if="informe.resumenEjecutivo" class="rg-preview-section rg-preview-resumen">
          <label>RESUMEN EJECUTIVO</label>
          <p>{{ informe.resumenEjecutivo }}</p>
        </div>

        <!-- KPIs -->
        <div v-if="informe.kpis && informe.kpis.length > 0" class="rg-preview-section">
          <label>RESULTADOS Y MÉTRICAS</label>
          <div class="rg-kpi-row">
            <div v-for="kpi in informe.kpis" :key="kpi.label" class="rg-kpi-card">
              <strong>{{ kpi.value }}</strong>
              <span>{{ kpi.label }}</span>
            </div>
          </div>
        </div>

        <!-- Tareas -->
        <div v-if="informe.tareas && informe.tareas.length > 0" class="rg-preview-section">
          <label>TRABAJOS REALIZADOS <span class="rg-horas-total">{{ totalHoras > 0 ? `· ${totalHoras}h totales` : '' }}</span></label>
          <div class="rg-tareas-list">
            <div v-for="t in informe.tareas" :key="t.titulo" class="rg-tarea-row">
              <div class="rg-tarea-left">
                <span class="rg-tarea-dot" :style="{ background: estadoColor[t.estado ?? 'Completada'] }"></span>
                <div>
                  <strong>{{ t.titulo }}</strong>
                  <span v-if="t.descripcion">{{ t.descripcion }}</span>
                  <span v-if="t.categoria" class="rg-tag">{{ t.categoria }}</span>
                </div>
              </div>
              <div class="rg-tarea-right">
                <span class="rg-estado" :style="{ color: estadoColor[t.estado ?? 'Completada'] }">{{ t.estado }}</span>
                <span v-if="t.horas" class="rg-horas">{{ t.horas }}h</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Imágenes adjuntas -->
        <div v-if="imageFiles.length > 0" class="rg-preview-section">
          <label>MATERIAL VISUAL ({{ imageFiles.length }} imágenes)</label>
          <div class="rg-images-preview-grid">
            <img v-for="(src, i) in imagePreviews" :key="i" :src="src" :alt="imageFiles[i]?.name" class="rg-preview-img" />
          </div>
        </div>

        <!-- Conclusiones -->
        <div v-if="informe.conclusiones" class="rg-preview-section rg-preview-resumen">
          <label>CONCLUSIONES</label>
          <p>{{ informe.conclusiones }}</p>
        </div>

        <!-- Próximos pasos -->
        <div v-if="informe.proximosPasos && informe.proximosPasos.length > 0" class="rg-preview-section">
          <label>PRÓXIMOS PASOS</label>
          <ol class="rg-steps-list">
            <li v-for="p in informe.proximosPasos" :key="p">{{ p }}</li>
          </ol>
        </div>

        <!-- Archivos NAS -->
        <div class="rg-preview-section">
          <label>ARCHIVOS Y ENTREGABLES</label>
          <div v-if="archivos.length > 0" class="rg-archivos-grid">
            <a
              v-for="f in archivos"
              :key="f.nombre"
              :href="f.url"
              target="_blank"
              class="rg-download-btn"
            >
              <span>{{ NAS_FILE_ICONS[f.tipo ?? 'other'] }}</span>
              <span class="rg-download-name">{{ f.nombre }}</span>
              <span class="rg-download-arrow">↗</span>
            </a>
          </div>

          <!-- Añadir archivo -->
          <div class="rg-add-archivo">
            <input v-model="archivoForm.nombre" class="rg-input" placeholder="nombre-archivo.pdf" @blur="archivoForm.nombre && (archivoForm as any).tipo || null" />
            <input v-model="archivoForm.url" class="rg-input rg-flex2" placeholder="http://192.168.1.x/archivo.pdf" />
            <input v-model="archivoForm.descripcion" class="rg-input" placeholder="Descripción (opcional)" />
            <button class="rg-btn-add" @click="addArchivo">+ Añadir</button>
          </div>
          <div v-if="archivos.length > 0" class="rg-archivos-chips">
            <div v-for="(f, i) in archivos" :key="i" class="rg-archivo-chip">
              <span>{{ NAS_FILE_ICONS[f.tipo ?? 'other'] }} {{ f.nombre }}</span>
              <button @click="removeArchivo(i)">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Botón PDF abajo también -->
      <div class="rg-result-actions">
        <button class="rg-btn-back" @click="mode = 'ai'">← Volver y regenerar</button>
        <button class="rg-btn-pdf rg-btn-pdf--large" @click="descargarPDF" :disabled="generandoPDF">
          {{ generandoPDF ? '⏳ Guardando y generando PDF…' : '💾 Guardar y Descargar PDF' }}
        </button>
      </div>
    </div>

    <!-- El histórico ahora se muestra en el perfil del cliente (AdminView) para mayor visibilidad -->
  </div>
</template>

<style scoped>
.rg { display: flex; flex-direction: column; gap: 1.25rem; }

/* ── AI Panel ─────────────────────────────────────────────── */
.rg-ai-panel { display: flex; flex-direction: column; gap: 1.25rem; }

.rg-ai-header { display: flex; gap: 1rem; align-items: flex-start; padding: 1.25rem; background: linear-gradient(135deg, rgba(227,255,4,0.07) 0%, transparent 100%); border: 1px solid rgba(227,255,4,0.2); border-radius: 10px; }
.rg-ai-badge { background: var(--color-primary, #e3ff04); color: #000; font-weight: 900; font-size: 0.78rem; padding: 0.3rem 0.6rem; border-radius: 6px; white-space: nowrap; align-self: flex-start; margin-top: 2px; }
.rg-ai-title { font-size: 1rem; font-weight: 800; margin: 0 0 0.25rem; color: var(--color-text-light, #fff); }
.rg-ai-sub { font-size: 0.82rem; color: var(--color-text-muted, #888); margin: 0; line-height: 1.5; }

.rg-field { display: flex; flex-direction: column; gap: 0.4rem; }
.rg-label { font-size: 0.85rem; font-weight: 700; color: var(--color-text-muted, #888); display: flex; flex-direction: column; gap: 0.15rem; }
.rg-hint { font-weight: 400; font-size: 0.75rem; color: rgba(255,255,255,0.3); }

.rg-textarea {
  background: rgba(255,255,255,0.04); border: 1px solid var(--color-border, #333);
  color: var(--color-text-light, #fff); padding: 0.75rem 1rem; border-radius: 8px;
  font-family: inherit; font-size: 0.9rem; resize: vertical; outline: none;
  width: 100%; box-sizing: border-box; color-scheme: dark; line-height: 1.6;
  transition: border-color 0.15s;
}
.rg-textarea:focus { border-color: var(--color-primary, #e3ff04); }
.rg-textarea::placeholder { color: rgba(255,255,255,0.18); }

/* Drop zone */
.rg-dropzone {
  border: 2px dashed var(--color-border, #333); border-radius: 10px;
  padding: 2rem; text-align: center; cursor: pointer;
  transition: all 0.2s; background: rgba(255,255,255,0.01);
}
.rg-dropzone:hover, .rg-dropzone--active {
  border-color: var(--color-primary, #e3ff04);
  background: rgba(227,255,4,0.04);
}
.rg-dropzone-inner { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
.rg-dropzone-icon { font-size: 2rem; }
.rg-dropzone p { font-size: 0.9rem; color: var(--color-text-muted, #888); margin: 0; }
.rg-dropzone p strong { color: var(--color-primary, #e3ff04); }
.rg-dropzone small { font-size: 0.75rem; color: rgba(255,255,255,0.3); }
.rg-hidden { display: none; }

/* Previews */
.rg-images-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.5rem; }
.rg-img-thumb { position: relative; width: 90px; }
.rg-img-thumb img { width: 90px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid var(--color-border, #333); display: block; }
.rg-img-name { font-size: 0.65rem; color: rgba(255,255,255,0.4); display: block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 90px; margin-top: 2px; }
.rg-img-remove { position: absolute; top: -5px; right: -5px; background: #f87171; color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 0.65rem; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }

/* Error */
.rg-error { color: #f87171; font-size: 0.85rem; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); padding: 0.6rem 0.9rem; border-radius: 6px; margin: 0; }

/* Botón generar */
.rg-btn-generate {
  background: var(--color-primary, #e3ff04); color: #000; font-weight: 900;
  padding: 0.9rem 2rem; border-radius: 10px; border: none; cursor: pointer;
  font-family: inherit; font-size: 1rem; display: flex; align-items: center;
  justify-content: center; gap: 0.6rem; transition: all 0.2s; width: 100%;
}
.rg-btn-generate:hover:not(:disabled) { background: #d4ed00; transform: translateY(-2px); box-shadow: 0 6px 24px rgba(227,255,4,0.3); }
.rg-btn-generate:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

/* Animación de puntos */
.rg-generating-anim { display: flex; gap: 4px; align-items: center; }
.rg-generating-anim span { width: 6px; height: 6px; background: #000; border-radius: 50%; animation: rg-bounce 1.2s infinite; }
.rg-generating-anim span:nth-child(2) { animation-delay: 0.2s; }
.rg-generating-anim span:nth-child(3) { animation-delay: 0.4s; }
@keyframes rg-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }

.rg-generating-hint { font-size: 0.82rem; color: var(--color-text-muted, #888); text-align: center; margin: 0; font-style: italic; }

/* ── Result ────────────────────────────────────────────────── */
.rg-result { display: flex; flex-direction: column; gap: 1.25rem; }

.rg-result-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; }
.rg-result-bar-right { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.rg-success-badge { font-size: 0.78rem; font-weight: 700; color: #4ade80; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.25); padding: 0.25rem 0.6rem; border-radius: 20px; }

.rg-btn-back { background: transparent; border: 1px solid var(--color-border, #333); color: var(--color-text-muted, #888); padding: 0.5rem 1rem; border-radius: 7px; cursor: pointer; font-family: inherit; font-size: 0.85rem; transition: all 0.2s; }
.rg-btn-back:hover { border-color: var(--color-text-muted, #888); color: var(--color-text-light, #fff); }

.rg-btn-pdf { background: var(--color-primary, #e3ff04); color: #000; font-weight: 800; padding: 0.55rem 1.25rem; border-radius: 8px; border: none; cursor: pointer; font-family: inherit; font-size: 0.9rem; transition: all 0.2s; }
.rg-btn-pdf:hover:not(:disabled) { background: #d4ed00; transform: translateY(-1px); }
.rg-btn-pdf:disabled { opacity: 0.6; cursor: not-allowed; }
.rg-btn-pdf--large { padding: 0.75rem 2rem; font-size: 1rem; }

/* Sugerencias */
.rg-suggestions { background: rgba(100,200,255,0.05); border: 1px solid rgba(100,200,255,0.2); border-radius: 10px; padding: 1rem 1.25rem; }
.rg-suggestions-title { font-size: 0.85rem; font-weight: 700; margin: 0 0 0.5rem; color: #64c8ff; }
.rg-suggestions ul { margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.3rem; }
.rg-suggestions li { font-size: 0.85rem; color: var(--color-text-muted, #888); }

/* Preview card */
.rg-preview-card { background: var(--color-bg-card, #1a1a1a); border: 1px solid var(--color-border, #333); border-radius: 12px; overflow: hidden; }

.rg-preview-header { background: #e3ff04; padding: 0.9rem 1.5rem; display: flex; justify-content: space-between; align-items: center; }
.rg-preview-agency { display: flex; align-items: center; gap: 0.75rem; }
.rg-preview-logo { width: 36px; height: 36px; background: #000; color: #e3ff04; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.1rem; flex-shrink: 0; }
.rg-preview-agency strong { display: block; font-size: 0.88rem; color: #000; font-weight: 900; }
.rg-preview-agency span { font-size: 0.72rem; color: #333; }
.rg-preview-tag { text-align: right; font-weight: 900; font-size: 1rem; color: #000; line-height: 1.2; }
.rg-preview-tag small { font-weight: 400; }

.rg-preview-meta-row { display: flex; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--color-border, #333); flex-wrap: wrap; }
.rg-preview-meta-row > div { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; }
.rg-preview-meta-row small { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted, #888); }
.rg-preview-meta-row strong { font-size: 0.95rem; color: var(--color-text-light, #fff); }
.rg-preview-meta-row span { font-size: 0.8rem; color: var(--color-text-muted, #888); }

.rg-preview-titulo { background: #121212; padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 800; color: #e3ff04; }

.rg-preview-section { padding: 1rem 1.5rem; border-bottom: 1px solid var(--color-border, #2a2a2a); display: flex; flex-direction: column; gap: 0.6rem; }
.rg-preview-section label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted, #888); }
.rg-preview-section p { font-size: 0.88rem; line-height: 1.65; color: var(--color-text-light, #fff); margin: 0; }
.rg-preview-resumen { background: rgba(248,255,200,0.03); border-left: 3px solid #e3ff04; }

/* KPIs */
.rg-kpi-row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.rg-kpi-card { flex: 1; min-width: 90px; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 0.75rem; display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
.rg-kpi-card strong { font-size: 1.3rem; color: var(--color-text-light, #fff); }
.rg-kpi-card span { font-size: 0.7rem; color: var(--color-text-muted, #888); text-align: center; }

/* Tareas */
.rg-tareas-list { display: flex; flex-direction: column; gap: 0.4rem; }
.rg-tarea-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 0.6rem 0.75rem; background: rgba(255,255,255,0.02); border-radius: 6px; }
.rg-tarea-left { display: flex; gap: 0.6rem; align-items: flex-start; flex: 1; }
.rg-tarea-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
.rg-tarea-left > div { display: flex; flex-direction: column; gap: 0.1rem; }
.rg-tarea-left strong { font-size: 0.88rem; color: var(--color-text-light, #fff); }
.rg-tarea-left span { font-size: 0.78rem; color: var(--color-text-muted, #888); }
.rg-tag { display: inline-block; font-size: 0.68rem; background: rgba(227,255,4,0.08); color: var(--color-primary, #e3ff04); border: 1px solid rgba(227,255,4,0.2); padding: 0.1rem 0.4rem; border-radius: 4px; width: fit-content; }
.rg-tarea-right { display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; }
.rg-estado { font-size: 0.72rem; font-weight: 700; }
.rg-horas { font-size: 0.82rem; font-weight: 700; color: var(--color-primary, #e3ff04); }
.rg-horas-total { font-weight: 400; font-size: 0.75rem; color: var(--color-primary, #e3ff04); }

/* Archivos */
.rg-archivos-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
.rg-download-btn { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(227,255,4,0.08); border: 1px solid rgba(227,255,4,0.3); color: var(--color-primary, #e3ff04); padding: 0.45rem 0.8rem; border-radius: 8px; text-decoration: none; font-size: 0.82rem; font-weight: 600; transition: all 0.15s; }
.rg-download-btn:hover { background: rgba(227,255,4,0.18); transform: translateY(-1px); }
.rg-download-name { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rg-download-arrow { font-size: 0.8rem; opacity: 0.6; }

/* Añadir archivo form */
.rg-add-archivo { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.rg-input { background: rgba(255,255,255,0.04); border: 1px solid var(--color-border, #333); color: var(--color-text-light, #fff); padding: 0.5rem 0.75rem; border-radius: 6px; font-family: inherit; font-size: 0.85rem; outline: none; box-sizing: border-box; color-scheme: dark; min-width: 120px; }
.rg-input:focus { border-color: var(--color-primary, #e3ff04); }
.rg-flex2 { flex: 2; }
.rg-btn-add { background: rgba(227,255,4,0.1); border: 1px solid rgba(227,255,4,0.3); color: var(--color-primary, #e3ff04); padding: 0.45rem 0.8rem; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 0.82rem; font-weight: 700; white-space: nowrap; transition: all 0.15s; }
.rg-btn-add:hover { background: rgba(227,255,4,0.2); }

.rg-archivos-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
.rg-archivo-chip { display: flex; align-items: center; gap: 0.4rem; background: rgba(255,255,255,0.05); border: 1px solid var(--color-border, #333); border-radius: 20px; padding: 0.25rem 0.6rem; font-size: 0.78rem; color: var(--color-text-muted, #888); }
.rg-archivo-chip button { background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.7rem; padding: 0; line-height: 1; }

.rg-result-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding-top: 0.5rem; }

/* Objetivos / Próximos pasos */
.rg-obj-list, .rg-steps-list { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }
.rg-obj-list li::before { content: '●'; color: var(--color-primary, #e3ff04); margin-right: 0.5rem; font-size: 0.7rem; }
.rg-obj-list li, .rg-steps-list li { font-size: 0.88rem; color: var(--color-text-light, #fff); line-height: 1.5; }
.rg-steps-list { counter-reset: step; padding-left: 0; }
.rg-steps-list li { counter-increment: step; display: flex; gap: 0.6rem; align-items: flex-start; }
.rg-steps-list li::before { content: counter(step); display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; min-width: 20px; background: var(--color-primary, #e3ff04); color: #000; border-radius: 50%; font-size: 0.7rem; font-weight: 900; margin-top: 1px; }

/* Images preview grid */
.rg-images-preview-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.rg-preview-img { width: 140px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid var(--color-border, #333); }

/* Histórico */
.rg-historico { background: var(--color-bg-card, #1a1a1a); border: 1px solid var(--color-border, #333); border-radius: 12px; padding: 1.25rem; }
.rg-historico-header { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
.rg-historico-icon { font-size: 1.5rem; }
.rg-historico-header strong { display: block; font-size: 0.95rem; color: var(--color-text-light, #fff); }
.rg-historico-header span { font-size: 0.78rem; color: var(--color-text-muted, #888); }
.rg-historico-list { display: flex; flex-direction: column; gap: 0.5rem; }
.rg-historico-item { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--color-border, #2a2a2a); }
.rg-historico-info { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; }
.rg-historico-info strong { font-size: 0.88rem; color: var(--color-text-light, #fff); }
.rg-historico-info span { font-size: 0.78rem; color: var(--color-text-muted, #888); }
.rg-historico-info small { font-size: 0.7rem; color: rgba(255,255,255,0.3); }
.rg-historico-actions { display: flex; gap: 0.4rem; align-items: center; flex-shrink: 0; }
.rg-btn-pdf--small { font-size: 0.78rem; padding: 0.35rem 0.7rem; text-decoration: none; }
.rg-btn-delete { background: none; border: 1px solid rgba(248,113,113,0.3); color: #f87171; padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: all 0.15s; }
.rg-btn-delete:hover { background: rgba(248,113,113,0.1); border-color: #f87171; }

@media (max-width: 600px) {
  .rg-add-archivo { flex-direction: column; }
  .rg-add-archivo .rg-input { width: 100%; }
  .rg-kpi-row { gap: 0.4rem; }
  .rg-preview-meta-row { flex-direction: column; }
  .rg-historico-item { flex-direction: column; align-items: flex-start; }
}
</style>
