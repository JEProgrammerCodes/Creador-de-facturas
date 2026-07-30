# Creador de Facturas

Una aplicación web profesional para crear, gestionar e imprimir facturas directamente en el navegador — sin servidor, sin instalaciones.

> **Demo:** Compatible con GitHub Pages. Abre `index.html` en cualquier navegador moderno.

---

## Características

- **Diseño moderno y responsive** — funciona en móvil, tableta y escritorio.
- **Datos completos de emisor y cliente** — nombre/empresa, NIF/RFC, dirección, correo, teléfono y logo opcional.
- **Metadatos de factura** — número, fecha de emisión, fecha de vencimiento, moneda y notas.
- **Gestión de conceptos** — agrega, edita y elimina líneas de conceptos con:
  - Descripción, cantidad, precio unitario
  - IVA % (configurable por ítem)
  - Descuento % por ítem
  - Subtotal calculado en tiempo real
- **Cálculos financieros robustos** — subtotal, descuentos, impuestos y total final con redondeo a 2 decimales.
- **Validación de formulario** — mensajes de error en línea y guardianes que impiden generar facturas incompletas.
- **Vista previa profesional** — diseño tipo A4 con encabezado, tabla de conceptos y totales.
- **Imprimir / Exportar PDF** — hoja de estilos de impresión optimizada para A4.
- **Historial con persistencia** — guarda facturas en `localStorage`, carga, edita y elimina.
- **Configuración** — IVA predeterminado, símbolo y código de moneda, datos de empresa por defecto.
- **Atajos de teclado** — `Ctrl+S` guarda, `Ctrl+P` imprime.

---

## Cómo ejecutar localmente

No se necesita instalar nada. Simplemente:

1. Clona o descarga este repositorio.
2. Abre `index.html` en tu navegador (doble clic o arrastrar al navegador).

```bash
git clone https://github.com/JEProgrammerCodes/Creador-de-facturas.git
cd Creador-de-facturas
# Abre index.html con tu navegador favorito
```

Para una mejor experiencia (e.g. evitar restricciones CORS con logos), usa un servidor local:

```bash
# Python 3
python3 -m http.server 8080
# Luego abre http://localhost:8080
```

---

## Cómo usar el generador de facturas

### 1. Configuración inicial (opcional)
Ve a la pestaña **Config.** y define:
- IVA predeterminado (%)
- Moneda y símbolo
- Datos de tu empresa (para rellenar automáticamente el formulario)

### 2. Crear una factura
1. Ve a la pestaña **Formulario**.
2. Rellena los **Datos del Emisor** (tu empresa). Usa **"Usar predeterminados"** si configuraste los datos de empresa.
3. Rellena los **Datos del Cliente**.
4. Completa los **Datos de la Factura** (número, fechas, moneda).
5. Agrega conceptos con **＋ Agregar concepto** — los totales se actualizan en tiempo real.
6. Haz clic en **Guardar** para almacenar la factura en el navegador.

### 3. Vista previa e impresión / PDF
1. Haz clic en **Vista Previa** para ver el diseño final de la factura.
2. Haz clic en **Imprimir / PDF** para abrir el diálogo de impresión del navegador.
3. En el diálogo de impresión, selecciona **"Guardar como PDF"** para exportar.

> **Consejo:** En Chrome/Edge elige *"Más configuraciones → Tamaño: A4, Márgenes: Predeterminado"* para mejores resultados.

### 4. Historial
La pestaña **Historial** muestra todas las facturas guardadas. Puedes:
- **Cargar** — abre la factura en el formulario para editarla.
- **Eliminar** — la elimina del historial (no se puede deshacer).

---

## Persistencia de datos

Los datos se guardan en el `localStorage` del navegador con estas claves:

| Clave                  | Contenido                          |
|------------------------|------------------------------------|
| `facturador_config`    | Configuración general              |
| `facturador_invoices`  | Array de facturas guardadas        |

> **Importante:** Los datos persisten mientras uses el mismo navegador y perfil. No se sincronizan entre dispositivos. Limpiar el caché del navegador eliminará las facturas guardadas.

---

## Estructura del proyecto

```
Creador-de-facturas/
├── index.html   — Estructura HTML y tabs (Formulario, Vista Previa, Historial, Config.)
├── styles.css   — Estilos modernos con variables CSS, responsive y @media print
├── script.js    — Lógica completa: estado, cálculos, validación, localStorage
└── README.md    — Documentación del proyecto
```

---

## Compatibilidad

- Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- Sin dependencias externas — solo HTML, CSS y JavaScript vanilla.
- Compatible con GitHub Pages (hosting estático).

---

## Licencia

MIT — consulta el archivo `LICENSE`.
