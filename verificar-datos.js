const Store = require('electron-store');
const store = new Store();

console.log('=== Verificación de datos ===');
console.log('Ventas:', store.get('ventas', []));
console.log('Pagos:', store.get('pagos', []));
console.log('Consumos Comida:', store.get('consumosComida', []));

const productos = store.get('productos', []);
console.log('Productos:', productos.length);

// Mostrar productos con precios
productos.forEach(p => {
  console.log(`SKU: ${p.sku}, Nombre: ${p.nombre}, Compra: ${p.precioCompra}, Venta: ${p.precioVenta}`);
});