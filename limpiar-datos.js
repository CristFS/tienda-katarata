const Store = require('electron-store');
const store = new Store();

// Limpiar ventas
store.set('ventas', []);
console.log('Ventas limpiadas');

// Limpiar pagos (deudas)
store.set('pagos', []);
console.log('Pagos (deudas) limpiados');

// Limpiar consumos de comida
store.set('consumosComida', []);
console.log('Consumos de comida limpiados');

// Limpiar personal (opcional - descomenta si necesitas limpiarlo también)
// store.set('personal', []);
// console.log('Personal limpiado');

// Verificar
console.log('Ventas actuales:', store.get('ventas', []).length);
console.log('Pagos actuales:', store.get('pagos', []).length);
console.log('Consumos actuales:', store.get('consumosComida', []).length);
console.log('Productos actuales:', store.get('productos', []).length);

console.log('\nDatos limpiados correctamente!');