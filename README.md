# Dashboard Tane Solutions

![Tane Solutions Dashboard](https://www.tanesolutions.com/favicon.ico)

Dashboard interno desarrollado para **Tane Solutions** con el objetivo de centralizar la gestión comercial, financiera, operativa y de soporte. Diseñado con una estética moderna en modo oscuro, integrando el verde lima característico de la marca y la tipografía *Unbounded*.

## 🚀 Tecnologías

* **Framework**: [Vue 3](https://vuejs.org/) (Composition API)
* **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite](https://vitejs.dev/)
* **Estilos**: CSS nativo con variables (Modo Oscuro por defecto)
* **Routing**: [Vue Router 4](https://router.vuejs.org/)
* **Fuente**: Unbounded (Google Fonts)

## 📦 Módulos del Sistema

La plataforma integra 4 módulos clave para la visión 360º del negocio:

### 1. 💼 Módulo Comercial (El Motor de Ventas)

Enfocado en el seguimiento de ingresos potenciales y efectividad del equipo.

* **KPIs**: Leads semanales, Tasa de conversión, Valor promedio, CAC.
* **Visualizaciones**: Embudo de ventas (Pipeline) con escala visual.
* **Servicios Top**: Ranking de los packs más vendidos.

### 2. 💰 Módulo Financiero (La Salud del Negocio)

Control exhaustivo de flujo de caja y rentabilidad.

* **KPIs**: Facturación mensual, MRR (Ingreso Recurrente), Cuentas por cobrar.
* **Visualizaciones**: Gráfico de barras comparativo (Año actual vs anterior).
* **Rentabilidad**: Análisis detallado por proyecto (Margen, Coste, Precio).

### 3. ⚙️ Módulo de Operaciones (Gestión de Proyectos)

Gestión de entregas y carga de trabajo para evitar cuellos de botella.

* **Estado de Proyectos**: Semáforo visual (Verde/Amarillo/Rojo) para identificar riesgos.
* **Carga de Equipo**: Barras de progreso visualizando la ocupación de cada miembro.
* **KPIs**: Tiempo medio de entrega, Proyectos activos.

### 4. 🎧 Módulo de Soporte y Calidad (Retención)

Monitorización de la satisfacción del cliente y estado técnico.

* **Tickets**: Listado de últimas incidencias con prioridad y tiempo de respuesta.
* **Servidores**: Monitorización de uptime de servicios críticos.
* **Churn Rate**: Tasa de cancelación mensual.

## 📱 Responsividad

El diseño es totalmente **responsive** y adpatado a dispositivos móviles:

* **Menú Lateral**: Navegación flotante con toggle (hamburguesa) que no interfiere con el contenido.
* **Tablas Adaptables**: Transformación automática de tablas en **tarjetas de datos** (sólo móvil) para evitar el scroll horizontal y mejorar la legibilidad.
* **Gráficos Flexibles**: Los elementos visuales como el embudo se ajustan al ancho de pantalla.

## 🛠️ Instalación y Uso

1. **Clonar el repositorio**:

    ```bash
    git clone https://github.com/JohnSM7/Tane-Solutions-Dashboard.git
    cd Tane-Solutions-Dashboard
    ```

2. **Instalar dependencias**:

    ```bash
    npm install
    ```

    *Nota: Requiere Node.js v20+ (LTS recommended)*

3. **Ejecutar servidor de desarrollo**:

    ```bash
    npm run dev
    ```

    Accede a `http://localhost:5173/`

4. **Compilar para producción**:

    ```bash
    npm run build
    ```
