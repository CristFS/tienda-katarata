const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Productos
  getProductos: () => ipcRenderer.invoke('get-productos'),
  saveProductos: (data) => ipcRenderer.invoke('save-productos', data),
  
  // Clientes
  getClientes: () => ipcRenderer.invoke('get-clientes'),
  saveClientes: (data) => ipcRenderer.invoke('save-clientes', data),
  
  // Ventas
  getVentas: () => ipcRenderer.invoke('get-ventas'),
  saveVentas: (data) => ipcRenderer.invoke('save-ventas', data),
  
  // Pagos
  getPagos: () => ipcRenderer.invoke('get-pagos'),
  savePagos: (data) => ipcRenderer.invoke('save-pagos', data),
  
  // Personal
  getPersonal: () => ipcRenderer.invoke('get-personal'),
  savePersonal: (data) => ipcRenderer.invoke('save-personal', data),
  importExcelPersonal: (buffer) => ipcRenderer.invoke('import-excel-personal', buffer),
  exportExcel: (wbJson, filename) => ipcRenderer.invoke('export-excel', wbJson, filename),
  
  // Fecha de campaña
  getFechaInicioCampana: () => ipcRenderer.invoke('get-fecha-inicio-campana'),
  saveFechaInicioCampana: (fecha) => ipcRenderer.invoke('save-fecha-inicio-campana', fecha),
  
  // Número de campaña
  getNumeroCampana: () => ipcRenderer.invoke('get-numero-campana'),
  setNumeroCampana: (n) => ipcRenderer.invoke('set-numero-campana', n),

  // Consumos de comida
  getConsumosComida: () => ipcRenderer.invoke('get-consumos-comida'),
  saveConsumosComida: (data) => ipcRenderer.invoke('save-consumos-comida', data),
  
  // Campaña
  cerrarCampana: async (data) => {
    try {
      const result = await ipcRenderer.invoke('cerrar-campana', data);
      return result;
    } catch (err) {
      return { success: false, error: String(err && err.message ? err.message : 'Error de comunicación') };
    }
  },
  
  // Recuperar campaña
  recuperarCampana: () => ipcRenderer.invoke('recuperar-campana')
});
