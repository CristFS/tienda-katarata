const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Verificar electron-store
let Store = null;
try {
  Store = require('electron-store');
} catch (e) {
  console.error('Error cargando electron-store:', e);
}

// Verificar xlsx
let XLSX = null;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('Error cargando xlsx:', e);
}

console.log('electron-store:', Store ? 'OK' : 'FALLO');
console.log('xlsx:', XLSX ? 'OK' : 'FALLO');

// Rutas portables usando app.getPath - carpeta Documents visible
function getAppPaths() {
  try {
    const documentsPath = app.getPath('documents');
    return {
      logFile: path.join(documentsPath, 'Tienda Katarata', 'logs', 'debug.log'),
      historialPath: path.join(documentsPath, 'Tienda Katarata', 'Historial'),
      exportPath: path.join(documentsPath, 'Tienda Katarata', 'Exportaciones')
    };
  } catch (e) {
    console.error('Error getAppPaths:', e);
    return null;
  }
}

// Log to file
function log(msg) {
  try {
    const paths = getAppPaths();
    if (paths && paths.logFile) {
      const time = new Date().toISOString();
      fs.appendFileSync(paths.logFile, time + ' ' + msg + '\n');
    }
    console.log(msg);
  } catch (e) {
    console.log(msg);
  }
}

// Store simple - inicializar con manejo de errores
let store = null;
try {
  if (Store) {
    store = new Store({
      name: 'tienda-katarata',
      defaults: {
        personal: [],
        productos: [],
        ventas: [],
        pagos: [],
        fechaInicioCampana: new Date().toISOString().split('T')[0],
        consumosComida: [],
        numeroCampana: 1
      }
    });
    log('Store inicializado en: ' + store.path);
  } else {
    log('Store no disponible - electron-store no cargó');
  }
} catch(e) {
  console.error('Error store:', e);
  log('Error store: ' + e.message);
}

let mainWindow;

function createWindow() {
  // Verificar que store está inicializado antes de usarlo
  if (!store) {
    console.error('Store no está inicializado - la app puede fallar');
  }
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
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
  
  // Log de diagnóstico al abrir la ventana (solo si store existe)
  if (store) {
    console.log('=== DIAGNÓSTICO STORE ===');
    console.log('Store path:', store.path);
    console.log('Personal en store:', store.get('personal', []).length);
    console.log('Productos en store:', store.get('productos', []).length);
    console.log('=======================');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// === HELPERS ===

// Helper para obtener rutas (disponible para todos los handlers)
function getPaths() {
  return getAppPaths();
}

// Helper para validar datos de entrada
function validateArray(data, fallback = []) {
  if (Array.isArray(data)) return data;
  return fallback;
}

// Wrapper seguro para json_to_sheet
function safeJsonToSheet(data) {
  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return XLSX.utils.json_to_sheet([{ 'SIN DATOS': '' }]);
    }
    return XLSX.utils.json_to_sheet(data);
  } catch (e) {
    console.error('Error json_to_sheet:', e);
    return XLSX.utils.json_to_sheet([{ 'ERROR': e.message }]);
  }
}

// Wrapper seguro para sheet_to_csv
function safeSheetToCSV(ws) {
  try {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return csv || '';
  } catch (e) {
    console.error('Error sheet_to_csv:', e);
    return '';
  }
}

// === DATA STORE ===

// Productos
ipcMain.handle('get-productos', () => store ? store.get('productos', []) : []);
ipcMain.handle('save-productos', (event, productos) => store && store.set('productos', productos));

// Clientes/Obreros
ipcMain.handle('get-clientes', () => store ? store.get('clientes', []) : []);
ipcMain.handle('save-clientes', (event, clientes) => store && store.set('clientes', clientes));

// Ventas
ipcMain.handle('get-ventas', () => store ? store.get('ventas', []) : []);
ipcMain.handle('save-ventas', (event, ventas) => store && store.set('ventas', validateArray(ventas)));

// Pagos
ipcMain.handle('get-pagos', () => store ? store.get('pagos', []) : []);
ipcMain.handle('save-pagos', (event, pagos) => store && store.set('pagos', validateArray(pagos)));

// Personal
ipcMain.handle('get-personal', () => {
  const personal = store ? store.get('personal', []) : [];
  console.log('[IPC] get-personal: returning', personal.length, 'records');
  return personal;
});
ipcMain.handle('save-personal', (event, personal) => {
  if (!store) return false;
  console.log('[IPC] save-personal: saving', validateArray(personal).length, 'records');
  store.set('personal', validateArray(personal));
  const verificar = store.get('personal', []);
  console.log('[IPC] save-personal: verified', verificar.length, 'records');
  return true;
});

// Campaña - Fecha de inicio
ipcMain.handle('get-fecha-inicio-campana', () => store ? store.get('fechaInicioCampana', new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]);
ipcMain.handle('save-fecha-inicio-campana', (event, fecha) => store && store.set('fechaInicioCampana', fecha));

// Consumos de Comida
ipcMain.handle('get-consumos-comida', () => store ? store.get('consumosComida', []) : []);
ipcMain.handle('save-consumos-comida', (event, consumos) => store && store.set('consumosComida', validateArray(consumos)));

// Recuperar campaña desde JSON
ipcMain.handle('recuperar-campana', async (event) => {
  try {
    const paths = getPaths();
    const historialPath = paths.historialPath;
    
    if (!fs.existsSync(historialPath)) {
      return { success: false, error: 'No hay historial de campañas' };
    }
    
    let archivos = fs.readdirSync(historialPath).filter(f => f.endsWith('.json'));
    
    if (archivos.length === 0) {
      return { success: false, error: 'No hay archivos de historial' };
    }
    
    // Ordenar correctamente por fecha (no lexicográfico)
    archivos.sort();
    const ultimoArchivo = archivos[archivos.length - 1]; // El último (más reciente)
    const fullPath = path.join(historialPath, ultimoArchivo);
    console.log('Cargando:', fullPath);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    
    // Guardar ventas y pagos en store (con fallbacks)
    store.set('ventas', data.ventas || []);
    store.set('pagos', data.pagos || []);
    
    return { 
      success: true, 
      mensaje: `Recuperadas ${(data.ventas || []).length} ventas`,
      totalDeuda: data.resumen ? data.resumen.totalDeuda : 0
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Importar Excel con clientes
ipcMain.handle('import-excel-clientes', async (event, data) => {
  try {
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);
    
    const clientes = json.map(row => ({
      codigo: String(row.Código || row.codigo || row.Codigo || '').trim(),
      dni: String(row.DNI || row.dni || '').trim(), // Fijo duplicado
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
ipcMain.handle('import-excel-personal', async (event, data) => {
  try {
    const workbook = XLSX.read(data, { type: 'buffer' });
    
    let sheet = null;
    for (const name of workbook.SheetNames) {
      const s = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(s);
      if (json.length > 0 && json[0]) {
        const columns = Object.keys(json[0]).map(k => k.toUpperCase().trim());
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
    
    if (json.length === 0) {
      return { success: false, error: 'El Excel está vacío' };
    }
    
    const codigosGenerados = new Set(); // Rastrear códigos generados en este batch para evitar colisiones
    
    const personal = json.map((row, index) => {
      if (!row) return null;
      
      const keys = Object.keys(row);
      
      let codigo = '';
      const codigoKeys = ['CODIGO', 'COD', 'CÓDIGO', 'CÓD'];
      for (const key of keys) {
        if (codigoKeys.includes(key.toUpperCase().trim())) {
          codigo = String(row[key] || '').trim();
          break;
        }
      }
      
      let nombre = '';
      const nombreKeys = ['NOMBRE Y APELLIDOS', 'NOMBRE', 'APELLIDOS', 'NOMBRECOMPLETO', 'TRABAJADOR', 'PERSONAL'];
      for (const key of keys) {
        const keyNorm = key.toUpperCase().replace(/\s+/g, '');
        if (nombreKeys.some(k => keyNorm.includes(k))) {
          nombre = String(row[key] || '').trim().toUpperCase();
          if (nombre) break;
        }
      }
      
      let dni = '';
      const dniKeys = ['DNI', 'DOCUMENTO', 'DOC_ID'];
      for (const key of keys) {
        if (dniKeys.includes(key.toUpperCase().trim())) {
          dni = String(row[key] || '').trim();
          break;
        }
      }
      
      let area = '';
      const areaKeys = ['AREA', 'ÁREA', 'DEPARTAMENTO', 'PUESTO', 'CENTRO'];
      for (const key of keys) {
        if (areaKeys.includes(key.toUpperCase().trim())) {
          area = String(row[key] || '').trim().toUpperCase();
          break;
        }
      }
      
      if (!codigo && !nombre && !dni && !area) {
        return null;
      }
      
      if (!codigo) {
        const prefijo = (nombre || '').trim().substring(0, 3).toUpperCase();
        const sufijo = (dni || '').replace(/\D/g, '').substring(0, 3);
        if (prefijo) {
          let base = prefijo + (sufijo || '000');
          codigo = base;
          let contador = 1;
          while (codigosGenerados.has(codigo)) {
            contador++;
            codigo = base + '-' + contador;
          }
        } else {
          codigo = String(index + 1);
        }
      }
      codigosGenerados.add(codigo);
      if (!area) area = 'SIN ÁREA';
      
      return {
        codigo: codigo,
        apellidosNombres: nombre || 'SIN NOMBRE',
        dni: dni || '',
        areaTrabajo: area
      };
    }).filter(p => p && p.codigo); // Filtrar nulos y sin código

    // Eliminar duplicados por código (mantener solo el primero)
    const personalMap = new Map();
    personal.forEach(p => {
      if (p && p.codigo && !personalMap.has(p.codigo)) {
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

// Exportar Excel (ASYNC)
ipcMain.handle('export-excel', async (event, data, filename) => {
  console.log('=== INICIO EXPORT ===');
  console.log('Filename:', filename);
  
  const paths = getPaths();
  const exportPath = paths.exportPath;
  
  try {
    // Crear directorio si no existe
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
    
    let wb;
    if (typeof data === 'string') {
      wb = JSON.parse(data);
    } else {
      wb = data;
    }
    
    console.log('wb tiene SheetNames:', wb && wb.SheetNames);
    
    const filePath = path.join(exportPath, filename);
    console.log('Escribiendo a:', filePath);
    
    // Usar writeFile (callback) para asegurar que se complete
    await new Promise((resolve, reject) => {
      XLSX.writeFile(wb, filePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('=== EXPORT EXITOSO ===');
    return filePath;
    
  } catch (err) {
    console.error('=== ERROR ===', err);
    return 'ERROR: ' + err.toString();
  }
});

// Cierre de campaña - exportar y resetear (ASYNC)
// Cierre de campaña - exportar 2 Excel y resetear
ipcMain.handle('get-numero-campana', () => {
  if (!store) return 1;
  return store.get('numeroCampana', 1);
});

ipcMain.handle('set-numero-campana', (event, n) => {
  if (store) store.set('numeroCampana', n);
});

ipcMain.handle('cerrar-campana', async (event, data) => {
  console.log('=== INICIO CIERRE CAMPAÑA ===');
  
  try {
    // 1. VALIDAR store
    if (!store) {
      return { success: false, error: 'Store no disponible' };
    }
    
    // 2. VALIDAR XLSX
    if (!XLSX) {
      return { success: false, error: 'XLSX no disponible' };
    }
    
    // 3. CREAR carpeta
    const paths = getAppPaths();
    if (!paths || !paths.exportPath) {
      return { success: false, error: 'Ruta de exportación no disponible' };
    }
    
    const exportPath = paths.exportPath;
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
    
    const numCampana = data.numeroCampana || 1;
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const carpetaPath = path.join(exportPath, `Campana_${numCampana}`);
    fs.mkdirSync(carpetaPath, { recursive: true });
    console.log('Carpeta creada:', carpetaPath);
    
    // 4. OBTENER datos
    const ventas = validateArray(data.ventas);
    const consumosComida = validateArray(data.consumosComida);
    const personal = validateArray(data.personal);
    const productos = validateArray(data.productos);
    const precioComida = data.precioComida || 10;
    
    console.log('Datos: ventas=' + ventas.length + ', comidas=' + consumosComida.length);
    
    // === EXCEL 1: DEUDAS (CODIGO, NOMBRE, DEUDA) ===
    console.log('Generando Excel de deudas...');
    
    const deudasRows = personal.map(p => {
      if (!p) return null;
      
      // Calcular ventas del cliente
      let totalVentas = 0;
      ventas.forEach(v => {
        if (v && v.clienteCodigo === p.codigo) {
          totalVentas += v.total || 0;
        }
      });
      
      // Calcular comidas del cliente
      let totalComida = 0;
      const misComidas = consumosComida.find(c => c && c.codigo === p.codigo);
      if (misComidas && misComidas.dias) {
        misComidas.dias.forEach(dia => {
          if (dia) {
            if (dia.desayuno) totalComida += precioComida;
            if (dia.almuerzo) totalComida += precioComida;
            if (dia.cena) totalComida += precioComida;
          }
        });
      }
      
      const deuda = totalVentas + totalComida;
      
      return {
        'CODIGO': p.codigo || '',
        'NOMBRE': p.apellidosNombres || p.nombre || '',
        'DEUDA': deuda
      };
    }).filter(r => r);
    
    // Crear workbook para deudas
    const wbDeudas = XLSX.utils.book_new();
    const wsDeudas = XLSX.utils.json_to_sheet(deudasRows);
    XLSX.utils.book_append_sheet(wbDeudas, wsDeudas, 'Deudas');
    
    const deudasPath = path.join(carpetaPath, `campana_${numCampana}_deudas.xlsx`);
    XLSX.writeFile(wbDeudas, deudasPath);
    console.log('Excel deudas guardado:', deudasPath);
    
    // === EXCEL 2: TRANSACCIONES (VENTAS + COMIDAS) ===
    console.log('Generando Excel de transacciones...');
    
    const transRows = [];
    
    // 2a. VENTAS
    ventas.forEach(v => {
      if (!v) return;
      if (v.items && v.items.length > 0) {
        const detalles = v.items
          .filter(item => item)
          .map(item => {
            const prod = productos.find(p => p && p.sku === item.sku);
            const nombre = prod ? (prod.nombre || '') : '';
            return (nombre || 'Producto') + ' x' + (item.cantidad || 0);
          });
        transRows.push({
          FECHA: v.fecha || '',
          TIPO: 'VENTA',
          CODIGO: v.clienteCodigo || '',
          NOMBRE: v.clienteNombre || '',
          DETALLE: detalles.join(', '),
          MONTO: v.total || 0
        });
      } else {
        transRows.push({
          FECHA: v.fecha || '',
          TIPO: 'VENTA',
          CODIGO: v.clienteCodigo || '',
          NOMBRE: v.clienteNombre || '',
          DETALLE: 'Venta',
          MONTO: v.total || 0
        });
      }
    });
    
    // 2b. COMIDAS
    const fechaInicioCampana = data.fechaInicioCampana || store.get('fechaInicioCampana', '');
    consumosComida.forEach(c => {
      if (!c || !c.dias) return;
      const trab = personal.find(p => p && p.codigo === c.codigo);
      c.dias.forEach(dia => {
        if (!dia) return;
        // Calcular fecha real del día
        let fechaDia = '';
        if (fechaInicioCampana && dia.dia) {
          const d = new Date(fechaInicioCampana + 'T12:00:00');
          d.setDate(d.getDate() + (dia.dia - 1));
          fechaDia = d.toISOString().split('T')[0];
        }
        const comidas = [];
        if (dia.desayuno) comidas.push('Desayuno');
        if (dia.almuerzo) comidas.push('Almuerzo');
        if (dia.cena) comidas.push('Cena');
        if (comidas.length > 0) {
          transRows.push({
            FECHA: fechaDia,
            TIPO: 'COMIDA',
            CODIGO: c.codigo || '',
            NOMBRE: trab ? (trab.apellidosNombres || trab.nombre) : '',
            DETALLE: comidas.join('+'),
            MONTO: precioComida * comidas.length
          });
        }
      });
    });
    
    // Ordenar por codigo y fecha
    transRows.sort((a, b) => {
      const codeA = a.CODIGO || '';
      const codeB = b.CODIGO || '';
      if (codeA !== codeB) return codeA.localeCompare(codeB);
      return (a.FECHA || '').localeCompare(b.FECHA || '');
    });
    
    // Crear workbook para transacciones
    const wbTrans = XLSX.utils.book_new();
    const wsTrans = XLSX.utils.json_to_sheet(transRows);
    XLSX.utils.book_append_sheet(wbTrans, wsTrans, 'Transacciones');
    
    const transPath = path.join(carpetaPath, `campana_${numCampana}_transacciones.xlsx`);
    XLSX.writeFile(wbTrans, transPath);
    console.log('Excel transacciones guardado:', transPath);
    
    // 5. CALCULAR resumen
    let totalVentas = 0, totalComidas = 0;
    transRows.forEach(r => {
      if (r.TIPO === 'VENTA') totalVentas += r.MONTO;
      else if (r.TIPO === 'COMIDA') totalComidas += r.MONTO;
    });
    const deudaTotal = totalVentas + totalComidas;
    
    console.log('Resumen: ventas=' + totalVentas + ', comidas=' + totalComidas + ', deuda=' + deudaTotal);
    
    // 6. RESETEAR store
    store.set('ventas', []);
    store.set('pagos', []);
    store.set('consumosComida', []);
    store.set('numeroCampana', numCampana + 1);
    console.log('Store reseteado');
    
    // 7. RETORNAR resultado
    console.log('=== CIERRE COMPLETADO ===');
    return {
      success: true,
      carpetaPath: carpetaPath,
      archivoDeudas: deudasPath,
      archivoTrans: transPath,
      numeroCampana: numCampana,
      resumen: {
        personal: personal.length,
        ventas: totalVentas,
        comidas: totalComidas,
        deuda: deudaTotal
      }
    };
    
  } catch (err) {
    console.error('Error cierre:', err);
    return { success: false, error: String(err && err.message ? err.message : 'Error desconocido') };
  }
});
