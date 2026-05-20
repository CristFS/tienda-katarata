const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// Log to file
const logFile = 'C:\\Users\\usuario\\AppData\\Roaming\\tienda-katarata\\debug.log';
function log(msg) {
  const time = new Date().toISOString();
  fs.appendFileSync(logFile, time + ' ' + msg + '\n');
  console.log(msg);
}

// Store simple - sin cwd para evitar problemas en exe
let store;
try {
  store = new Store({
    name: 'tienda-katarata',
    defaults: {
      personal: [],
      productos: [],
      ventas: [],
      pagos: [],
      fechaInicioCampana: '2026-05-11',
      consumosComida: []
    }
  });
  console.log('Store path:', store.path);
  log('Store inicializado');
} catch(e) {
  console.error('Error store:', e);
  log('Error store: ' + e.message);
}

console.log('Store path:', store.path);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    devTools: true
  });

  const htmlPath = path.join(__dirname, '../renderer/index.html');
  log('createWindow: HTML path = ' + htmlPath);
  console.log('Cargando HTML desde:', htmlPath);
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log('Fallo al cargar: ' + errorCode + ' ' + errorDescription);
    console.error('Fallo al cargar:', errorCode, errorDescription);
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log('Render gone: ' + details.reason);
    console.error('Render gone:', details.reason);
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    log('did-finish-load event fired');
  });
  
  mainWindow.webContents.on('did-ready-to-show', () => {
    log('did-ready-to-show event fired - showing window');
    mainWindow.show();
  });
  
  mainWindow.loadFile(htmlPath).then(() => {
    log('HTML cargado exitosamente - mostrando ventana');
    console.log('HTML cargado exitosamente');
    mainWindow.show();
    log('Ventana mostrada');
  }).catch(err => {
    console.error('Error cargando HTML:', err);
    mainWindow.show();
  });
  
  mainWindow.setMenuBarVisibility(false);
  
  // Log de diagnóstico al abrir la ventana
  console.log('=== DIAGNÓSTICO STORE ===');
  console.log('Store path:', store.path);
  console.log('Personal en store:', store.get('personal', []).length);
  console.log('Productos en store:', store.get('productos', []).length);
  console.log('=======================');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// === DATA STORE ===

// Productos
ipcMain.handle('get-productos', () => store.get('productos', []));
ipcMain.handle('save-productos', (event, productos) => store.set('productos', productos));

// Clientes/Obreros
ipcMain.handle('get-clientes', () => store.get('clientes', []));
ipcMain.handle('save-clientes', (event, clientes) => store.set('clientes', clientes));

// Ventas
ipcMain.handle('get-ventas', () => store.get('ventas', []));
ipcMain.handle('save-ventas', (event, ventas) => store.set('ventas', ventas));

// Pagos
ipcMain.handle('get-pagos', () => store.get('pagos', []));
ipcMain.handle('save-pagos', (event, pagos) => store.set('pagos', pagos));

// Personal
ipcMain.handle('get-personal', () => {
  const personal = store.get('personal', []);
  console.log('[IPC] get-personal: returning', personal.length, 'records. Data:', JSON.stringify(personal).substring(0, 200));
  return personal;
});
ipcMain.handle('save-personal', (event, personal) => {
  console.log('[IPC] save-personal: saving', personal.length, 'records. Data:', JSON.stringify(personal).substring(0, 200));
  store.set('personal', personal);
  // Verificar que se guardó
  const verificar = store.get('personal', []);
  console.log('[IPC] save-personal: verified', verificar.length, 'records');
  return true;
});

// Campaña - Fecha de inicio (14 días dura cada campaña)
ipcMain.handle('get-fecha-inicio-campana', () => store.get('fechaInicioCampana', '2026-05-11'));
ipcMain.handle('save-fecha-inicio-campana', (event, fecha) => store.set('fechaInicioCampana', fecha));

// Consumos de Comida
ipcMain.handle('get-consumos-comida', () => store.get('consumosComida', []));
ipcMain.handle('save-consumos-comida', (event, consumos) => store.set('consumosComida', consumos));

// Recuperar campaña desde JSON
ipcMain.handle('recuperar-campana', async (event) => {
  try {
    // Ruta corregida - buscar en la ubicación correcta
    const historialPath = 'C:\\Users\\usuario\\OneDrive\\Imágenes\\PROYECTO DE MEJORA KATARATA\\app-tienda\\Documentos exportados\\historial_campanas';
    
    if (!fs.existsSync(historialPath)) {
      return { success: false, error: 'No hay historial de campañas' };
    }
    
    const archivos = fs.readdirSync(historialPath).filter(f => f.endsWith('.json'));
    
    if (archivos.length === 0) {
      return { success: false, error: 'No hay archivos de historial' };
    }
    
    // Usar el más reciente
    const ultimoArchivo = archivos.sort().reverse()[0];
    const fullPath = path.join(historialPath, ultimoArchivo);
    console.log('Cargando:', fullPath);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    
    // Guardar ventas y pagos en store
    store.set('ventas', data.detalleVentas);
    store.set('pagos', data.detallePagos || []);
    
    return { 
      success: true, 
      mensaje: `Recuperadas ${data.detalleVentas.length} ventas`,
      totalDeuda: data.totalDeuda
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Importar Excel con clientes
ipcMain.handle('import-excel-clientes', async (event, data) => {
  const XLSX = require('xlsx');
  try {
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);
    
    // Normalizar datos
    const clientes = json.map(row => ({
      codigo: String(row.Código || row.codigo || row.Codigo || '').trim(),
      dni: String(row.DNI || row.dni || row.DNI || '').trim(),
      nombre: String(row.Nombre || row.nombre || row.NOMBRE || '').trim().toUpperCase(),
      puesto: String(row.Puesto || row.puesto || row.PUESTO || '').trim().toUpperCase(),
      area: String(row.Area || row.area || row.AREA || '').trim().toUpperCase()
    })).filter(c => c.codigo && c.nombre);
    
    return { success: true, clientes };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Importar Excel con Personal
// Formato esperado: CODIGO, NOMBRES Y APELLIDOS, DNI, AREA
ipcMain.handle('import-excel-personal', async (event, data) => {
  const XLSX = require('xlsx');
  try {
    const workbook = XLSX.read(data, { type: 'buffer' });
    
    // Buscar la primera hoja con datos
    let sheet = null;
    for (const name of workbook.SheetNames) {
      const s = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(s);
      if (json.length > 0 && json[0]) {
        const columns = Object.keys(json[0]).map(k => k.toUpperCase().trim());
        // Verificar que tenga al menos las columnas mínimas (CODIGO o NOMBRES, y DNI o AREA)
        const hasRequired = columns.some(c => c.includes('CODIGO') || c.includes('NOMBRE')) || 
                           columns.some(c => c.includes('DNI') || c.includes('AREA'));
        if (hasRequired) {
          sheet = s;
          break;
        }
      }
    }
    
    if (!sheet) {
      sheet = workbook.Sheets[workbook.SheetNames[0]];
    }
    
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    // Debug: mostrar las columnas encontradas
    const columnas = Object.keys(json[0] || {});
    console.log('Columnas del Excel:', columnas);
    
    if (json.length === 0) {
      return { success: false, error: 'El Excel está vacío' };
    }
    
    const personal = json.map((row, index) => {
      // Obtener los valores usando los nombres exactos de columnas
      // Soportar variaciones: con/sin espacios, mayúsculas/minúsculas
      
      const keys = Object.keys(row);
      console.log('Fila ' + index + ' keys:', keys);
      
      // CODIGO - buscar múltiples variaciones
      let codigo = '';
      const codigoKeys = ['CODIGO', 'COD', 'CÓDIGO', 'CÓD'];
      for (const key of keys) {
        if (codigoKeys.includes(key.toUpperCase().trim())) {
          codigo = String(row[key] || '').trim();
          break;
        }
      }
      
      // NOMBRES Y APELLIDOS - buscar múltiples variaciones
      let nombre = '';
      const nombreKeys = ['NOMBRE Y APELLIDOS', 'NOMBRE', 'APELLIDOS', 'NOMBRECOMPLETO', 'TRABAJADOR', 'PERSONAL'];
      for (const key of keys) {
        const keyNorm = key.toUpperCase().replace(/\s+/g, '');
        if (nombreKeys.some(k => keyNorm.includes(k))) {
          nombre = String(row[key] || '').trim().toUpperCase();
          if (nombre) break;
        }
      }
      
      // DNI - buscar múltiples variaciones
      let dni = '';
      const dniKeys = ['DNI', 'DOCUMENTO', 'DOC_ID'];
      for (const key of keys) {
        if (dniKeys.includes(key.toUpperCase().trim())) {
          dni = String(row[key] || '').trim();
          break;
        }
      }
      
      // AREA - buscar múltiples variaciones
      let area = '';
      const areaKeys = ['AREA', 'ÁREA', 'DEPARTAMENTO', 'PUESTO', 'CENTRO'];
      for (const key of keys) {
        if (areaKeys.includes(key.toUpperCase().trim())) {
          area = String(row[key] || '').trim().toUpperCase();
          break;
        }
      }
      
      console.log('Fila ' + index + ': codigo=' + codigo + ', nombre=' + nombre + ', dni=' + dni + ', area=' + area);
      
      // Aceptar filas que tengan AL MENOS código O nombre O DNI
      if (!codigo && !nombre && !dni && !area) {
        console.log('Fila ' + index + ' ignorada - sin datos relevantes');
        return null;
      }
      
      // Si no hay código, generar uno automáticamente
      if (!codigo) {
        codigo = String(index + 1);
      }
      
      // Si no hay área, usar un valor por defecto
      if (!area) {
        area = 'SIN ÁREA';
      }
      
      // Devolver objeto con nombres de campos consistentes con el renderer
      return {
        codigo: codigo,
        apellidosNombres: nombre || 'SIN NOMBRE',
        dni: dni || '',
        areaTrabajo: area
      };
    });

    // Eliminar duplicados por código (mantener solo el primero)
    const personalMap = new Map();
    personal.forEach(p => {
      if (p.codigo && !personalMap.has(p.codigo)) {
        personalMap.set(p.codigo, p);
      }
    });
    const personalFinal = Array.from(personalMap.values());
    
    console.log('Personal importado:', personalFinal.length, 'registros');
    return { success: true, personal: personalFinal };
  } catch (err) {
    console.error('Error importación:', err);
    return { success: false, error: err.message };
  }
});

// Exportar Excel
ipcMain.handle('export-excel', async (event, data, filename) => {
  console.log('=== INICIO EXPORT ===');
  console.log('Filename:', filename);
  
  const exportPath = 'C:\\Users\\usuario\\OneDrive\\Imágenes\\PROYECTO DE MEJORA KATARATA\\app-tienda\\Documentos exportados';
  
  try {
    // Verificar que la data viene como string y parsearla
    console.log('Tipo de data:', typeof data);
    
    let wb;
    if (typeof data === 'string') {
      console.log('Parseando JSON...');
      wb = JSON.parse(data);
    } else {
      wb = data;
    }
    
    console.log('wb tiene SheetNames:', wb && wb.SheetNames);
    
    // Usar XLSX para escribir
    const XLSX = require('xlsx');
    const filePath = path.join(exportPath, filename);
    
    console.log('Escribiendo a:', filePath);
    XLSX.writeFile(wb, filePath);
    
    console.log('=== EXPORT EXITOSO ===');
    return filePath;
    
  } catch (err) {
    console.error('=== ERROR ===', err);
    return 'ERROR: ' + err.toString();
  }
});