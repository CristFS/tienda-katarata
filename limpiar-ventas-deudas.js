const Store = require('electron-store');
const store = new Store();

// Solo limpiar ventas y deudas - NO tocar personal
store.set('ventas', []);
console.log('Ventas limpiadas');

store.set('pagos', []);
console.log('Pagos (deudas) limpiados');

store.set('consumosComida', []);
console.log('Consumos de comida limpiados');

// NO limpiamos personal - se mantiene intacto

// Verificar
console.log('---');
console.log('Ventas:', store.get('ventas', []).length);
console.log('Pagos:', store.get('pagos', []).length);
console.log('Consumos:', store.get('consumosComida', []).length);
console.log('Personal:', store.get('personal', []).length, 'registros');

console.log('\nSolo ventas y deudas eliminadas. Personal intacto.');