import { GoogleGenAI } from '@google/genai';
import type { InformeProyecto, TareaInforme } from './reportes';

// ── Cliente Gemini ─────────────────────────────────────────────────────────────
function getClient(): GoogleGenAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  if (!apiKey || apiKey.startsWith('TU_API_KEY')) {
    throw new Error(
      'VITE_GEMINI_API_KEY no configurada. Añade tu API key de Google AI Studio en el fichero .env'
    );
  }
  return new GoogleGenAI({ apiKey });
}

// ── Tipos de respuesta ─────────────────────────────────────────────────────────
export type AIImageInput = {
  base64: string;   // datos base64 sin el prefijo "data:..."
  mimeType: string; // "image/jpeg", "image/png", etc.
  nombre: string;
};

export type AIGenerationResult = {
  informe: Partial<InformeProyecto>;
  suggestions: string[]; // sugerencias adicionales de la IA
};

// ── Prompt de sistema ──────────────────────────────────────────────────────────
function buildSystemPrompt(clienteNombre: string): string {
  return `Eres el asistente de contenido de Tane Solutions, una agencia de marketing digital y tecnología.
Tu tarea es analizar el briefing de trabajo que te proporciona el equipo y generar automáticamente un
informe profesional estructurado para el cliente "${clienteNombre}".

INSTRUCCIONES:
- Analiza el texto y todas las imágenes adjuntas (capturas de pantalla, fotos de trabajo, mockups, estadísticas, etc.)
- Extrae información relevante: qué se ha hecho, métricas visibles, hitos alcanzados, herramientas usadas
- Redacta en español, tono profesional pero cercano, primera persona del plural ("hemos", "realizamos")
- Los KPIs deben ser específicos y basados en los datos visibles; si no hay datos, omite ese campo
- Las tareas deben ser concretas y accionables, no genéricas
- El resumen ejecutivo debe ser inspirador y enfocado en el valor aportado al cliente

Devuelve ÚNICAMENTE un objeto JSON válido con exactamente esta estructura (sin texto adicional, sin markdown, sin backticks):
{
  "tituloInforme": "string - título atractivo y descriptivo",
  "proyectoNombre": "string - nombre corto del proyecto o servicio",
  "descripcionGeneral": "string - 2-4 frases explicando el proyecto y su contexto",
  "objetivos": ["string - objetivo concreto del proyecto (3-5 objetivos)"],
  "resumenEjecutivo": "string - párrafo de 3-5 líneas resumiendo logros y valor aportado",
  "periodo": "string - período del trabajo, ej: Marzo 2025 o Q1 2025 (infiere del contexto)",
  "kpis": [
    { "label": "string - nombre de la métrica", "value": "string - valor con unidad, ej: +120%" }
  ],
  "tareas": [
    {
      "titulo": "string - nombre de la tarea",
      "descripcion": "string - descripción breve de qué se hizo",
      "horas": number_o_null,
      "estado": "Completada",
      "categoria": "string - categoría, ej: Diseño, SEO, Desarrollo, Contenidos, Analítica"
    }
  ],
  "conclusiones": "string - 2-3 frases de conclusión valorando el resultado global del trabajo",
  "proximosPasos": ["string - próximo paso recomendado (2-4 pasos)"],
  "suggestions": ["string - sugerencia interna para el equipo de Tane (no aparece en el informe)"]
}`;
}

// ── Convertir File a AIImageInput ──────────────────────────────────────────────
export async function fileToAIImage(file: File): Promise<AIImageInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Quitar el prefijo "data:image/xxx;base64,"
      const base64 = result.split(',')[1] ?? '';
      resolve({
        base64,
        mimeType: file.type || 'image/jpeg',
        nombre: file.name,
      });
    };
    reader.onerror = () => reject(new Error(`Error al leer el archivo ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ── Llamada principal a Gemini ─────────────────────────────────────────────────
export async function generateInformeConIA(
  prompt: string,
  clienteNombre: string,
  imagenes: AIImageInput[],
  proyectoNombreHint?: string,
): Promise<AIGenerationResult> {
  const client = getClient();

  // Construir los parts de la request (multimodal)
  const parts: any[] = [
    {
      text: buildSystemPrompt(clienteNombre),
    },
    {
      text: `\n\n--- BRIEFING DEL EQUIPO ---\nCliente: ${clienteNombre}${proyectoNombreHint ? `\nProyecto: ${proyectoNombreHint}` : ''}\n\n${prompt}\n\n${imagenes.length > 0 ? `Se adjuntan ${imagenes.length} imagen(es) con material de referencia.` : ''}`,
    },
  ];

  // Añadir imágenes
  for (const img of imagenes) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      },
    });
    parts.push({
      text: `[Imagen adjunta: ${img.nombre}]`,
    });
  }

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
    config: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  });

  const rawText = response.text ?? '';
  console.log('[AI Report] Raw response length:', rawText.length);
  console.log('[AI Report] Raw response preview:', rawText.substring(0, 300));

  // Parsear el JSON — Gemini a veces envuelve en ```json ... ``` o añade texto extra
  let parsed: any;
  let cleanText = rawText.trim();

  // 1. Quitar bloques de código markdown (```json ... ``` o ``` ... ```)
  const codeBlockMatch = cleanText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleanText = codeBlockMatch[1].trim();
  }

  // 2. Intentar parsear directamente
  try {
    parsed = JSON.parse(cleanText);
  } catch {
    // 3. Buscar el objeto JSON más grande en el texto
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI Report] No JSON found in response:', cleanText.substring(0, 500));
      throw new Error(
        'La IA no devolvió un JSON válido. Por favor, intenta de nuevo.'
      );
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[AI Report] JSON parse failed:', parseErr, '\nExtracted:', jsonMatch[0].substring(0, 500));
      throw new Error('Error al procesar la respuesta de la IA. Revisa la consola para más detalles.');
    }
  }

  // Mapear a InformeProyecto
  const tareas: TareaInforme[] = (parsed.tareas ?? []).map((t: any) => ({
    titulo:      t.titulo      ?? '',
    descripcion: t.descripcion ?? '',
    horas:       typeof t.horas === 'number' ? t.horas : undefined,
    estado:      (['Completada', 'En progreso', 'Pendiente'].includes(t.estado) ? t.estado : 'Completada') as TareaInforme['estado'],
    categoria:   t.categoria   ?? '',
  }));

  const informe: Partial<InformeProyecto> = {
    tituloInforme:      parsed.tituloInforme      ?? '',
    proyectoNombre:     parsed.proyectoNombre      ?? proyectoNombreHint ?? '',
    descripcionGeneral: parsed.descripcionGeneral  ?? '',
    objetivos:          parsed.objetivos           ?? [],
    resumenEjecutivo:   parsed.resumenEjecutivo    ?? '',
    periodo:            parsed.periodo             ?? '',
    conclusiones:       parsed.conclusiones        ?? '',
    proximosPasos:      parsed.proximosPasos       ?? [],
    kpis:               parsed.kpis               ?? [],
    tareas,
  };

  return {
    informe,
    suggestions: parsed.suggestions ?? [],
  };
}
