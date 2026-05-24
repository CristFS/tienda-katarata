# Backup Version: Toast System (20-05-2026)

## Descripción
Versión con sistema de notificaciones toast para reemplazar alert() y evitar bloqueo del DOM en ingresos consecutivos.

## Archivos incluidos
- `src/renderer/app.js` - UI con toast system
- `src/main/main.js` - Lógica principal
- `src/main/preload.js` - API segura (nodeIntegration: false)
- `src/renderer/index.html` - Estructura HTML
- `src/renderer/styles/main.css` - Estilos
- `package.json` - Configuración del proyecto

## Cambios principales de esta versión

### 1. Sistema Toast (reemplaza alert)
```javascript
window.showToast = function(mensaje, tipo = 'success')
```
- No bloquea el thread de JavaScript
- Desaparece automáticamente después de 3 segundos
- Colores: success (verde), error (rojo), info (azul)

### 2. confirmarIngreso() simplificado
- Eliminados alert() → usan showToast()
- Eliminados setTimeout → renderizado inmediato
- Sin delays que puedan causar race conditions

### 3. Inputs con timestamps únicos
```javascript
id="ingreso-cantidad-{timestamp}"
id="ingreso-precio-compra-{timestamp}"
```
- Evita conflictos con elementos residuales del DOM

### 4. Sin atributos min en number inputs
- Validación se hace en JavaScript
- Evita bloqueo del spinbutton en Chromium

## Problema que resuelve
**Bug:** Después del primer registro de ingreso, los campos de cantidad y precio quedaban bloqueados para escribir (solo funcionaban las flechitas +/- del spinbutton de number input).

**Causa:** El alert() bloqueaba el thread y causaba race conditions con el re-renderizado del DOM.

**Solución:** Toast no bloquea, renderizado inmediato sin setTimeout.

## Para restaurar
```powershell
Copy-Item "backup_version_toast_20-05-2026/app.js" "src/renderer/" -Force
```