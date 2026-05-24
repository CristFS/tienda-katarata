const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const XLSX = require('xlsx');

// Rutas portables usando app.getPath
function getAppPaths() {
  const userDataPath = app.getPath('userData');
  return {
    logFile: path.join(userDataPath, 'debug.log'),
    historialPath: path.join(userDataPath, 'historial_campanas'),
    exportPath: path.join(userDataPath, 'Documentos exportados')
  };
}

// Log to file
function log(msg) {
  try {
    const paths = getAppPaths();
    const time = new Date().toISOString();
    fs.appendFileSync(paths.logFile, time + ' ' + msg + '\n');
    console.log(msg);
  } catch (e) {
    console.log(msg); // Fallback si no se puede escribir
  }
}

// Store simple - inicializar con manejo de errores
let store = null;
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
  log('Store inicializado en: ' + store.path);
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
ipcMain.handle('get-fecha-inicio-campana', () => store ? store.get('fechaInicioCampana', '2026-05-11') : '2026-05-11');
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
      
      if (!codigo) codigo = String(index + 1);
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
ipcMain.handle('cerrar-campana', async (event, data) => {
  try {
    const paths = getPaths();
    const exportPath = paths.exportPath;
    const historialPath = paths.historialPath;
    
    // Crear carpetas si no existen
    if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath, { recursive: true });
    if (!fs.existsSync(historialPath)) fs.mkdirSync(historialPath, { recursive: true });
    
    // Generar nombre de archivo con timestamp
    const now = new Date();
    const fecha = now.toISOString().split('T')[0];
    const tiempo = String(now.getHours()).padStart(2, '0') + '-' + 
                 String(now.getMinutes()).padStart(2, '0') + '-' + 
                 String(now.getSeconds()).padStart(2, '0');
    const timestamp = fecha + '_' + tiempo;
    
    // Validar datos de entrada
    const ventas = validateArray(data.ventas);
    const pagos = validateArray(data.pagos);
    const consumosComida = validateArray(data.consumosComida);
    const personal = validateArray(data.personal);
    const productos = validateArray(data.productos);
    
    // === 1. Generar JSON ===
    const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
    const totalPagos = pagos.reduce((sum, p) => sum + (p.monto || 0), 0);
    const totalDeuda = totalVentas - totalPagos;
    const totalComida = consumosComida.reduce((sum, c) => {
      if (c && c.dias) {
        return sum + c.dias.filter(d => d && (d.desayuno || d.almuerzo || d.cena)).length;
      }
      return sum;
    }, 0);
    const precioComida = data.precioComida || 10;
    const costoComida = totalComida * precioComida;
    
    const jsonData = {
      fechaCierre: fecha,
      horaCierre: tiempo,
      resumen: {
        totalPersonal: personal.length,
        totalVentas: totalVentas,
        totalPagos: totalPagos,
        totalDeuda: totalDeuda,
        totalComidas: totalComida,
        costoComidaTotal: costoComida
      },
      personal: personal,
      ventas: ventas,
      pagos: pagos,
      consumosComida: consumosComida,
      productos: productos
    };
    
    const jsonPath = path.join(historialPath, `campana_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log('JSON guardado:', jsonPath);
    
    // === 2. Generar Excel ===
    const wb = XLSX.utils.book_new();
    
    // Hoja 1: Resumen general
    const resumenGeneral = [{
      'FECHA CIERRE': fecha,
      'TOTAL PERSONAL': personal.length,
      'TOTAL VENTAS': totalVentas,
      'TOTAL PAGOS': totalPagos,
      'DEUDA PENDIENTE': totalDeuda,
      'TOTAL COMIDAS': totalComida,
      'COSTO COMIDA': costoComida
    }];
    const wsResumen = XLSX.utils.json_to_sheet(resumenGeneral);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    
    // Hoja 2: Resumen por colaborador
    const resumenCols = personal.map(p => {
      if (!p) return null;
      const misVentas = ventas.filter(v => v && v.clienteCodigo === p.codigo);
      const misPagos = pagos.filter(pa => pa && pa.clienteCodigo === p.codigo);
      const misComida = consumosComida.find(c => c && c.codigo === p.codigo);
      const totalPersonalVentas = misVentas.reduce((sum, v) => sum + (v.total || 0), 0);
      const totalPersonalPagos = misPagos.reduce((sum, pa) => sum + (pa.monto || 0), 0);
      
      let desayunos = 0, almuerzos = 0, cenas = 0;
      if (misComida && misComida.dias) {
        misComida.dias.forEach(d => {
          if (d) {
            if (d.desayuno) desayunos++;
            if (d.almuerzo) almuerzos++;
            if (d.cena) cenas++;
          }
        });
      }
      const totalComidasPersona = desayunos + almuerzos + cenas;
      const costoComidaPersona = totalComidasPersona * precioComida;
      
      return {
        'CODIGO': p.codigo || '',
        'NOMBRE': p.apellidosNombres || p.nombre || '',
        'AREA': p.areaTrabajo || p.area || '',
        'DNI': p.dni || '',
        'DESAYUNOS': desayunos,
        'ALMUERZOS': almuerzos,
        'CENAS': cenas,
        'TOTAL COMIDAS': totalComidasPersona,
        'COSTO COMIDA': costoComidaPersona,
        'TOTAL COMPRAS': totalPersonalVentas,
        'TOTAL PAGOS': totalPersonalPagos,
        'DEUDA': Math.max(0, totalPersonalVentas - totalPersonalPagos)
      };
    }).filter(r => r);
    const wsColaboradores = XLSX.utils.json_to_sheet(resumenCols);
    XLSX.utils.book_append_sheet(wb, wsColaboradores, 'Colaboradores');
    
    // Hoja 3: Detalle de ventas
    const ventasData = [];
    ventas.forEach(v => {
      if (v && v.items && v.items.length > 0) {
        v.items.forEach(item => {
          if (item) {
            ventasData.push({
              'FECHA': v.fecha || '',
              'CODIGO': v.clienteCodigo || '',
              'NOMBRE': v.clienteNombre || '',
              'PRODUCTO': item.sku || '',
              'CANTIDAD': item.cantidad || 0,
              'PRECIO': item.precioVenta || 0,
              'SUBTOTAL': (item.cantidad || 0) * (item.precioVenta || 0)
            });
          }
        });
      }
    });
    const wsVentas = XLSX.utils.json_to_sheet(ventasData);
    XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');
    
    // Hoja 4: Pagos
    const pagosData = pagos.map(p => {
      if (!p) return null;
      const trab = personal.find(pe => pe && pe.codigo === p.clienteCodigo);
      return {
        'FECHA': p.fecha || '',
        'CODIGO': p.clienteCodigo || '',
        'NOMBRE': trab ? (trab.apellidosNombres || trab.nombre) : 'N/A',
        'MONTO': p.monto || 0
      };
    }).filter(p => p);
    const wsPagos = XLSX.utils.json_to_sheet(pagosData);
    XLSX.utils.book_append_sheet(wb, wsPagos, 'Pagos');
    
    // Hoja 5: Comida detallada
    const comidaData = [];
    consumosComida.forEach(c => {
      if (!c || !c.dias) return;
      const trab = personal.find(p => p && p.codigo === c.codigo);
      const nombre = trab ? (trab.apellidosNombres || trab.nombre) : 'N/A';
      const area = trab ? (trab.areaTrabajo || trab.area) : '';
      
      c.dias.forEach(dia => {
        if (!dia) return;
        if (dia.desayuno) {
          comidaData.push({
            'CODIGO': c.codigo || '',
            'NOMBRE': nombre,
            'AREA': area,
            'DIA': dia.dia || 0,
            'TIPO': 'Desayuno',
            'MONTO': precioComida
          });
        }
        if (dia.almuerzo) {
          comidaData.push({
            'CODIGO': c.codigo || '',
            'NOMBRE': nombre,
            'AREA': area,
            'DIA': dia.dia || 0,
            'TIPO': 'Almuerzo',
            'MONTO': precioComida
          });
        }
        if (dia.cena) {
          comidaData.push({
            'CODIGO': c.codigo || '',
            'NOMBRE': nombre,
            'AREA': area,
            'DIA': dia.dia || 0,
            'TIPO': 'Cena',
            'MONTO': precioComida
          });
        }
      });
    });
    const wsComida = XLSX.utils.json_to_sheet(comidaData);
    XLSX.utils.book_append_sheet(wb, wsComida, 'Comida');
    
    const excelPath = path.join(historialPath, `reporte_campana_${timestamp}.xlsx`);
    
    // Escribir Excel de forma asíncrona
    await new Promise((resolve, reject) => {
      XLSX.writeFile(wb, excelPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Excel guardado:', excelPath);
    
    // === 3. Resetear datos en store ===
    store.set('ventas', []);
    store.set('pagos', []);
    store.set('consumosComida', []);
    store.set('fechaInicioCampana', fecha);
    
    console.log('=== CIERRE DE CAMPAÑA COMPLETADO ===');
    
    return {
      success: true,
      jsonPath: jsonPath,
      excelPath: excelPath,
      mensaje: 'Campaña cerrada correctamente'
    };
    
  } catch (err) {
    console.error('Error cierre campaña:', err);
    return { success: false, error: err.message };
  }
});