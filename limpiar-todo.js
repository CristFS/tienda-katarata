const Store = require('electron-store');
const fs = require('fs');

// Ubicación del store
const storePath = 'C:\\Users\\usuario\\AppData\\Roaming\\electron-store-nodejs\\Config\\config.json';

console.log('Limpiando datos...\n');

// Si existe el archivo, eliminarlo y crear uno vacío
if (fs.existsSync(storePath)) {
  fs.writeFileSync(storePath, JSON.stringify({
    productos: [],
    clientes: [],
    ventas: [],
    pagos: [],
    personal: [],
    consumosComida: [],
    fechaInicioCampana: "2026-05-11"
  }, null, 2));
  console.log('Archivo de config reseteado');
}

// También crear un nuevo store y limpiarlo
const store = new Store();
store.set('productos', []);
store.set('ventas', []);
store.set('pagos', []);
store.set('consumosComida', []);
store.set('personal', []);

console.log('Store limpiado');
console.log('\nVerificación:');
console.log('Ventas:', store.get('ventas'));
console.log('Pagos:', store.get('pagos'));
console.log('Productos:', store.get('productos'));
console.log('\n✅ Datos limpiados completamente');