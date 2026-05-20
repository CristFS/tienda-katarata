const Store = require('electron-store');
const store = new Store();

console.log('Ruta del archivo config:', store.path);
console.log('=== Verificación de datos ===');
console.log('Ventas:', JSON.stringify(store.get('ventas', [])));
console.log('Pagos:', JSON.stringify(store.get('pagos', [])));
console.log('Productos:', JSON.stringify(store.get('productos', [])));