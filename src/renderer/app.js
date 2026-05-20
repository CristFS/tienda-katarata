console.log('app.js starting...');
const { ipcRenderer } = require('electron');
console.log('electron loaded');

let productos = [];
let ventas = [];
let pagos = [];
let personal = [];
let consumosComida = [];
let currentView = 'dashboard';

function getPersonalInfo(p) {
  return {
    nombre: p.apellidosNombres || p.nombre || '-',
    area: p.areaTrabajo || p.area || '-'
  };
}

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('=== INICIANDO APP ===');
    await loadData();
    console.log('=== DATOS CARGADOS ===');
    setupNavigation();
    renderView('dashboard');
    document.getElementById('date-display').textContent = new Date().toLocaleDateString('es');
  } catch(e) {
    console.error('Error inicial:', e);
  }
});

async function loadData() {
  try {
    // Cargar productos
    const productosData = await ipcRenderer.invoke('get-productos');
    productos = Array.isArray(productosData) ? productosData : [];
    console.log('Cargados productos:', productos.length);
    
    // Cargar ventas
    const ventasData = await ipcRenderer.invoke('get-ventas');
    ventas = Array.isArray(ventasData) ? ventasData : [];
    console.log('Cargadas ventas:', ventas.length);
    
    // Cargar pagos
    const pagosData = await ipcRenderer.invoke('get-pagos');
    pagos = Array.isArray(pagosData) ? pagosData : [];
    console.log('Cargados pagos:', pagos.length);
    
    // Cargar personal
    const personalData = await ipcRenderer.invoke('get-personal');
    personal = Array.isArray(personalData) ? personalData : [];
    console.log('Cargado personal:', personal.length);
    
    // Cargar consumos de comida
    const consumosData = await ipcRenderer.invoke('get-consumos-comida');
    consumosComida = Array.isArray(consumosData) ? consumosData : [];
    console.log('Cargados consumos comida:', consumosComida.length);
  } catch(e) {
    console.error('Error cargando datos:', e);
    alert('Error al cargar datos: ' + e.message);
  }
}

function setupNavigation() {
  const items = document.querySelectorAll('.menu li');
  items.forEach(li => {
    li.addEventListener('click', () => {
      items.forEach(l => l.classList.remove('active'));
      li.classList.add('active');
      currentView = li.dataset.view;
      document.getElementById('page-title').textContent = li.textContent.trim();
      renderView(currentView);
    });
  });
}

async function renderView(view) {
  const content = document.getElementById('content');
  try {
    switch(view) {
      case 'dashboard': renderDashboard(content); break;
      case 'productos': renderProductos(content); break;
      case 'ingresos': renderIngresos(content); break;
      case 'personal': await renderPersonal(content); break;
      case 'comida': renderComida(content); break;
      case 'ventas': renderVentas(content); break;
      case 'deudas': renderDeudas(content); break;
      case 'reportes': renderReportes(content); break;
    }
  } catch(e) {
    console.error('Error render:', e);
    content.innerHTML = '<p style="color:red">Error cargando vista</p>';
  }
}

// ================== DASHBOARD ==================
function renderDashboard(content) {
  const totalVentas = ventas.length;
  const totalDeuda = calcularDeudaTotal();
  const productosStock = productos.filter(p => p.stock > 0).length;
  const hoy = new Date().toLocaleDateString('es');
  const ventasHoy = ventas.filter(v => v.fecha === hoy).length;
  const deudores = getDeudores();
  
  // Calcular totales de comida
  const totalComida = personal.reduce((sum, p) => sum + calcularCostoComidaPersonal(p.codigo), 0);
  const totalesComidaGlobal = personal.reduce((acc, p) => {
    const consumos = getConsumosParaCodigo(p.codigo);
    const t = calcularTotalesComida(consumos);
    acc.desayunos += t.desayunos;
    acc.almuerzos += t.almuerzos;
    acc.cenas += t.cenas;
    acc.total += t.total;
    return acc;
  }, { desayunos: 0, almuerzos: 0, cenas: 0, total: 0 });
  
  const totalGeneral = ventas.reduce((s, v) => s + v.total, 0) + totalComida;
  
  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>${totalVentas}</h3>
        <p>Total Ventas</p>
      </div>
      <div class="stat-card">
        <h3>S/ ${totalGeneral.toFixed(2)}</h3>
        <p>Total General</p>
      </div>
      <div class="stat-card" style="background:#fef3c7">
        <h3 style="color:#fd7e14">S/ ${totalComida.toFixed(2)}</h3>
        <p>Total Comida</p>
      </div>
      <div class="stat-card" style="background:#dc3545; color:white">
        <h3>S/ ${totalDeuda.toFixed(2)}</h3>
        <p>Deuda Total</p>
      </div>
      <div class="stat-card">
        <h3 style="color: var(--success)">${ventasHoy}</h3>
        <p>Ventas Hoy</p>
      </div>
      <div class="stat-card">
        <h3>${productosStock}</h3>
        <p>Productos en Stock</p>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px">
      <div class="card">
        <h3>📦 Productos en Stock</h3>
        <p style="color: #666">${productosStock} productos disponibles</p>
        ${productosStock > 0 ? `
          <table>
            <thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th>Stock</th></tr></thead>
            <tbody>
              ${productos.slice(0, 5).map(p => `<tr><td>${p.sku || '-'}</td><td>${p.nombre}</td><td>${p.categoria}</td><td>${p.stock}</td></tr>`).join('')}
            </tbody>
          </table>
        ` : '<p style="padding:20px; text-align:center; color:#666">No hay productos</p>'}
      </div>
      <div class="card">
        <h3>👥 Personal con Deuda</h3>
        ${deudores.length > 0 ? `
          <table>
            <thead><tr><th>Nombre</th><th>Área</th><th>Deuda</th></tr></thead>
            <tbody>
              ${deudores.slice(0, 5).map(c => {
                const detalle = getDetalleDeuda(c.codigo);
                return `
                <tr>
                  <td>${c.apellidosNombres}</td>
                  <td>${c.areaTrabajo}</td>
                  <td>
                    <span style="color:#dc3545; font-weight:bold">S/ ${detalle.total.toFixed(2)}</span>
                    <br><small style="color:#666">Com: S/ ${detalle.comida.toFixed(2)} | Com: S/ ${detalle.compras.toFixed(2)}</small>
                  </td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        ` : '<p style="padding:20px; text-align:center; color:#666">No hay deudas pendientes</p>'}
      </div>
    </div>
    
    <div class="card" style="margin-top:20px">
      <h3>🍽️ Resumen de Comidas</h3>
      <div style="display:flex; gap:20px; flex-wrap:wrap">
        <div style="background:#fff3cd; padding:15px 25px; border-radius:8px; text-align:center">
          <div style="font-size:2rem">☕</div>
          <div style="font-size:1.5rem; font-weight:bold; color:#fd7e14">${totalesComidaGlobal.desayunos}</div>
          <div style="color:#666">Desayunos</div>
        </div>
        <div style="background:#d4edda; padding:15px 25px; border-radius:8px; text-align:center">
          <div style="font-size:2rem">🍱</div>
          <div style="font-size:1.5rem; font-weight:bold; color:#28a745">${totalesComidaGlobal.almuerzos}</div>
          <div style="color:#666">Almuerzos</div>
        </div>
        <div style="background:#e2e3e5; padding:15px 25px; border-radius:8px; text-align:center">
          <div style="font-size:2rem">🌙</div>
          <div style="font-size:1.5rem; font-weight:bold; color:#6f42c1">${totalesComidaGlobal.cenas}</div>
          <div style="color:#666">Cenas</div>
        </div>
        <div style="background:#007bff; color:white; padding:15px 25px; border-radius:8px; text-align:center">
          <div style="font-size:2rem">🍽️</div>
          <div style="font-size:1.5rem; font-weight:bold">${totalesComidaGlobal.total}</div>
          <div style="color:rgba(255,255,255,0.8)">Total Comidas</div>
        </div>
      </div>
    </div>
  `;
}

// ================== PRODUCTOS ==================
function renderProductos(content) {
  content.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; margin-bottom:20px">
        <h3>Catálogo de Productos</h3>
        <button class="btn btn-primary" onclick="showModal('producto')">+ Nuevo Producto</button>
      </div>
      <p style="color:#666; margin-bottom:15px; font-size:0.9rem">
        <strong>Formato SKU:</strong> Letra de categoría + 5 dígitos (ej: S00001, B00002, P00003)<br>
        <em>S=Snack, B=Bebida, P=Panadería, C=Chocolate, O=Otro</em>
      </p>
      <table>
        <thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Stock</th><th>Compra</th><th>Venta</th><th>Acciones</th></tr></thead>
        <tbody>
          ${productos.map(p => `
            <tr>
              <td><strong>${p.sku || 'Sin código'}</strong></td>
              <td><strong>${p.nombre}</strong></td>
              <td><span class="badge" style="background:${p.categoria === 'Snack' ? '#fef3c7' : p.categoria === 'Bebida' ? '#dbeafe' : p.categoria === 'Panadería' ? '#fce7f3' : p.categoria === 'Chocolate' ? '#f3e8ff' : '#e5e7eb'}; color:#333; padding:3px 8px; border-radius:3px">${p.categoria}</span></td>
              <td>${p.stock}</td>
              <td>S/ ${(p.precioCompra || 0).toFixed(2)}</td>
              <td>S/ ${(p.precioVenta || 0).toFixed(2)}</td>
              <td>
                <button class="btn" style="background:#007bff; color:white; padding:5px 10px; margin-right:5px" onclick="editarProducto('${p.sku}')">✏️</button>
                <button class="btn btn-danger" style="padding:5px 10px" onclick="eliminarProducto('${p.sku}')">🗑️</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="7" style="text-align:center">No hay productos</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// Generar SKU automático según categoría
function generarSKU(categoria) {
  const prefijos = {
    'Snack': 'S',
    'Bebida': 'B',
    'Panadería': 'P',
    'Chocolate': 'C',
    'Otro': 'O'
  };
  const prefijo = prefijos[categoria] || 'O';
  const productosCategoria = productos.filter(p => p.categoria === categoria);
  const siguienteNumero = productosCategoria.length + 1;
  return prefijo + String(siguienteNumero).padStart(5, '0');
}

// Editar producto
window.editarProducto = function(sku) {
  const prod = productos.find(p => p.sku === sku);
  if (!prod) return;
  document.getElementById('producto-sku').value = prod.sku;
  document.getElementById('producto-nombre').value = prod.nombre;
  document.getElementById('producto-categoria').value = prod.categoria;
  document.getElementById('producto-stock').value = prod.stock;
  document.getElementById('producto-precio-compra').value = prod.precioCompra || 0;
  document.getElementById('producto-precio-venta').value = prod.precioVenta || 0;
  document.getElementById('modal-titulo-producto').textContent = 'Editar Producto';
  showModal('producto', true);
};

window.guardarProducto = async function(e) {
  e.preventDefault();
  const skuInput = document.getElementById('producto-sku').value;
  const nombreInput = document.getElementById('producto-nombre').value;
  const categoriaInput = document.getElementById('producto-categoria').value;
  const stockInput = parseInt(document.getElementById('producto-stock').value);
  const precioCompraInput = parseFloat(document.getElementById('producto-precio-compra').value) || 0;
  const precioVentaInput = parseFloat(document.getElementById('producto-precio-venta').value) || 0;
  
  if (skuInput) {
    const index = productos.findIndex(p => p.sku === skuInput);
    if (index >= 0) {
      productos[index] = {
        ...productos[index],
        nombre: nombreInput.toUpperCase(),
        categoria: categoriaInput,
        stock: stockInput,
        precioCompra: precioCompraInput,
        precioVenta: precioVentaInput
      };
    }
  } else {
    const nuevoSKU = generarSKU(categoriaInput);
    productos.push({
      sku: nuevoSKU,
      nombre: nombreInput.toUpperCase(),
      categoria: categoriaInput,
      stock: stockInput,
      precioCompra: precioCompraInput,
      precioVenta: precioVentaInput
    });
  }
  
  await ipcRenderer.invoke('save-productos', productos);
  closeModal('producto');
  renderView('productos');
  document.getElementById('producto-sku').value = '';
  document.getElementById('modal-titulo-producto').textContent = 'Nuevo Producto';
};

window.eliminarProducto = async function(sku) {
  if (confirm('¿Eliminar este producto?')) {
    productos = productos.filter(p => p.sku !== sku);
    await ipcRenderer.invoke('save-productos', productos);
    renderView('productos');
  }
};

// ================== INGRESOS ==================
function renderIngresos(content) {
  content.innerHTML = `
    <div class="card">
      <h3>📥 Ingreso de Mercancía</h3>
      <p style="color:#666; margin-bottom:20px">Registre la entrada de productos al almacén</p>
      <div class="form-group">
        <label>Seleccionar Producto</label>
        <select id="ingreso-producto" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px; font-size:1rem" onchange="cargarProductoIngreso()">
          <option value="">-- Seleccione un producto --</option>
          ${productos.map(p => `<option value="${p.sku}">${p.nombre} (${p.categoria})</option>`).join('')}
        </select>
      </div>
      <div id="info-producto-ingreso" style="display:none; background:#f7fafc; padding:15px; border-radius:8px; margin-top:15px">
        <h4>Información del Producto</h4>
        <p><strong>Nombre:</strong> <span id="ingreso-nombre"></span></p>
        <p><strong>Stock Actual:</strong> <span id="ingreso-stock-actual"></span></p>
        <p><strong>Precio de Compra Actual:</strong> S/ <span id="ingreso-precio-compra-actual"></span></p>
        <p><strong>Precio de Venta:</strong> S/ <span id="ingreso-precio-venta"></span></p>
      </div>
      <div id="form-ingreso" style="display:none; margin-top:20px; padding:20px; background:#fff; border:1px solid #ddd; border-radius:8px">
        <h4 style="margin-bottom:15px">Registrar Ingreso</h4>
        <div class="form-group">
          <label style="display:block; margin-bottom:5px; font-weight:600">Cantidad a Ingresar</label>
          <input type="number" id="ingreso-cantidad" min="1" value="1" style="width:100%; padding:12px; border:1px solid #ccc; border-radius:5px; font-size:1rem">
        </div>
        <div class="form-group">
          <label style="display:block; margin-bottom:5px; font-weight:600">Precio de Compra por Unidad (S/)</label>
          <input type="number" id="ingreso-precio-compra" step="0.01" min="0" placeholder="0.00" style="width:100%; padding:12px; border:1px solid #ccc; border-radius:5px; font-size:1rem">
        </div>
        <div id="preview-nuevo-precio" style="display:none; margin:10px 0; padding:10px; background:#e8f5e9; border-radius:5px; font-size:0.9rem">
          <strong>📊 Precio de Compra Ponderado:</strong><br>
          <span id="preview-formula"></span>
        </div>
        <button class="btn btn-success" onclick="confirmarIngreso()" style="padding:12px 24px; font-size:1rem; margin-top:10px">✅ Registrar Ingreso</button>
      </div>
    </div>
  `;
}

window.cargarProductoIngreso = function() {
  const sku = document.getElementById('ingreso-producto').value;
  if (!sku) {
    document.getElementById('info-producto-ingreso').style.display = 'none';
    document.getElementById('form-ingreso').style.display = 'none';
    return;
  }
  const prod = productos.find(p => p.sku === sku);
  if (!prod) return;
  document.getElementById('info-producto-ingreso').style.display = 'block';
  document.getElementById('ingreso-nombre').textContent = prod.nombre;
  document.getElementById('ingreso-stock-actual').textContent = prod.stock;
  document.getElementById('ingreso-precio-compra-actual').textContent = (prod.precioCompra || 0).toFixed(2);
  document.getElementById('ingreso-precio-venta').textContent = (prod.precioVenta || 0).toFixed(2);
  document.getElementById('form-ingreso').style.display = 'block';
  
  // Limpiar campos y preview
  document.getElementById('ingreso-cantidad').value = 1;
  document.getElementById('ingreso-precio-compra').value = '';
  document.getElementById('preview-nuevo-precio').style.display = 'none';
  
  // Agregar listeners para calcular precio ponderado en tiempo real
  const cantidadInput = document.getElementById('ingreso-cantidad');
  const precioInput = document.getElementById('ingreso-precio-compra');
  
  const calcularPreview = () => {
    const cantidad = parseInt(cantidadInput.value) || 0;
    const precioNuevo = parseFloat(precioInput.value) || 0;
    const stockActual = prod.stock;
    const precioActual = prod.precioCompra || 0;
    
    const previewDiv = document.getElementById('preview-nuevo-precio');
    const formulaSpan = document.getElementById('preview-formula');
    
    if (cantidad > 0 && precioNuevo > 0) {
      const totalCantidad = stockActual + cantidad;
      const precioPonderado = ((precioActual * stockActual) + (precioNuevo * cantidad)) / totalCantidad;
      
      formulaSpan.innerHTML = `(S/ ${precioActual.toFixed(2)} × ${stockActual}) + (S/ ${precioNuevo.toFixed(2)} × ${cantidad}) ÷ (${stockActual} + ${cantidad}) = <strong>S/ ${precioPonderado.toFixed(2)}</strong>`;
      previewDiv.style.display = 'block';
    } else {
      previewDiv.style.display = 'none';
    }
  };
  
  cantidadInput.oninput = calcularPreview;
  precioInput.oninput = calcularPreview;
};

window.confirmarIngreso = async function() {
  const sku = document.getElementById('ingreso-producto').value;
  const cantidad = parseInt(document.getElementById('ingreso-cantidad').value);
  const precioCompra = parseFloat(document.getElementById('ingreso-precio-compra').value) || 0;
  
  if (!sku || cantidad < 1) { alert('Seleccione un producto y cantidad válida'); return; }
  if (precioCompra <= 0) { alert('Ingrese el precio de compra'); return; }
  
  const prod = productos.find(p => p.sku === sku);
  if (!prod) { alert('Producto no encontrado'); return; }
  
  const stockAnterior = prod.stock;
  const precioCompraAnterior = prod.precioCompra || 0;
  
  // Calcular nuevo precio de compra ponderado
  const stockNuevo = stockAnterior + cantidad;
  const nuevoPrecioCompra = ((precioCompraAnterior * stockAnterior) + (precioCompra * cantidad)) / stockNuevo;
  
  // Actualizar producto
  prod.stock = stockNuevo;
  prod.precioCompra = parseFloat(nuevoPrecioCompra.toFixed(2)); // Redondear a 2 decimales
  
  await ipcRenderer.invoke('save-productos', productos);
  alert(`Ingreso registrado: +${cantidad} unidades de ${prod.nombre}\nStock: ${stockAnterior} → ${stockNuevo}\nNuevo precio de compra: S/ ${nuevoPrecioCompra.toFixed(2)}`);
  productos = await ipcRenderer.invoke('get-productos');
  renderView('ingresos');
};

// ================== PERSONAL ==================
let personalBusqueda = '';

async function renderPersonal(content) {
  const personalData = await ipcRenderer.invoke('get-personal');
  personal = (personalData && Array.isArray(personalData)) ? personalData : [];
  
  // Filtrar según búsqueda - SOLO por código y nombre
  const personalFiltrado = personalBusqueda 
    ? personal.filter(p => {
        const codigo = (p.codigo || '').toLowerCase();
        const nombre = (p.apellidosNombres || p.nombre || '').toLowerCase();
        const termino = personalBusqueda.toLowerCase();
        return codigo.includes(termino) || nombre.includes(termino);
      })
    : personal;
  
  let html = '<div style="padding:20px; font-family:Arial">';
  html += '<h2>👥 Personal</h2>';
  html += '<div style="margin:15px 0; display:flex; gap:10px; flex-wrap:wrap; align-items:center">';
  html += '<button onclick="showModal(\'personal\')" style="padding:8px 16px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer">➕ Nuevo Personal</button>';
  html += '<button onclick="importarPersonalExcel()" style="padding:8px 16px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer">📥 Importar desde Excel</button>';
  html += '<button onclick="exportarPersonalExcel()" style="padding:8px 16px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer">📤 Exportar a Excel</button>';
  html += '<button onclick="borrarTodoPersonal()" style="padding:8px 16px; background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer; margin-left:auto">🗑️ Borrar Todo</button>';
  html += '</div>';
  
  // Barra de búsqueda - con valor correcto preservado
  html += '<div style="margin:15px 0">';
  html += '<input type="text" id="busqueda-personal" placeholder="🔍 Buscar por código o nombre..." value="' + personalBusqueda.replace(/"/g, '&quot;') + '" oninput="buscarPersonal(this.value)" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:5px; font-size:1rem">';
  html += '</div>';
  
  if (personalFiltrado.length === 0) {
    if (personalBusqueda) {
      html += '<p style="color:orange">⚠️ No se encontraron resultados para "' + personalBusqueda + '"</p>';
    } else {
      html += '<p style="color:orange">⚠️ No hay personal cargado. Use el botón "Importar desde Excel" para cargar los datos.</p>';
    }
  } else {
    html += '<p>Mostrando ' + personalFiltrado.length + ' de ' + personal.length + ' trabajadores</p>';
    html += '<table style="width:100%; border-collapse:collapse; border:1px solid #ccc">';
    html += '<thead><tr style="background:#f0f0f0">';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:left">Código</th>';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:left">Nombres y Apellidos</th>';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:left">DNI</th>';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:left">Área</th>';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:center">Acciones</th>';
    html += '</tr></thead><tbody>';
    
    for (let i = 0; i < personalFiltrado.length; i++) {
      let p = personalFiltrado[i];
      let nombre = p.apellidosNombres || p.nombre || '-';
      let area = p.areaTrabajo || p.area || '-';
      html += '<tr>';
      html += '<td style="padding:8px; border:1px solid #ccc">' + (p.codigo || '-') + '</td>';
      html += '<td style="padding:8px; border:1px solid #ccc">' + nombre + '</td>';
      html += '<td style="padding:8px; border:1px solid #ccc">' + (p.dni || '-') + '</td>';
      html += '<td style="padding:8px; border:1px solid #ccc">' + area + '</td>';
      html += '<td style="padding:8px; border:1px solid #ccc; text-align:center">';
      html += '<button onclick="editarPersonal(\'' + p.codigo.replace(/'/g, "\\'") + '\')" style="padding:4px 8px; cursor:pointer">✏️</button>';
      html += '<button onclick="eliminarPersonal(\'' + p.codigo.replace(/'/g, "\\'") + '\')" style="padding:4px 8px; cursor:pointer; margin-left:5px">🗑️</button>';
      html += '</td></tr>';
    }
    html += '</tbody></table>';
  }
  html += '</div>';
  content.innerHTML = html;
  
  // Enfocar el input de búsqueda si hay un término de búsqueda
  if (personalBusqueda) {
    setTimeout(() => {
      const input = document.getElementById('busqueda-personal');
      if (input) {
        input.focus();
        // Mover el cursor al final
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 50);
  }
}

// Función de búsqueda simplificada
window.buscarPersonal = function(texto) {
  personalBusqueda = texto;
  const content = document.getElementById('content');
  if (content) {
    renderPersonal(content);
  }
};

// Función para borrar todo el personal
window.borrarTodoPersonal = async function() {
  if (!confirm('⚠️ ¿Estás seguro de eliminar TODO el personal?\n\nEsta acción eliminará todos los registros de personal del sistema y no se puede deshacer.')) {
    return;
  }
  if (!confirm('¿CONFIRMAR? Se eliminarán todos los trabajadores.')) {
    return;
  }
  
  personal = [];
  await ipcRenderer.invoke('save-personal', []);
  personalBusqueda = '';
  await renderPersonal(document.getElementById('content'));
  alert('✅ Todo el personal ha sido eliminado');
}

// Editar personal
window.editarPersonal = function(codigo) {
  const pers = personal.find(p => p.codigo === codigo);
  if (!pers) return;
  document.getElementById('personal-codigo-original').value = pers.codigo;
  document.getElementById('personal-codigo').value = pers.codigo;
  document.getElementById('personal-nombres').value = pers.apellidosNombres || pers.nombre || '';
  document.getElementById('personal-dni').value = pers.dni;
  document.getElementById('personal-area').value = pers.areaTrabajo || pers.area || '';
  document.getElementById('modal-titulo-personal').textContent = 'Editar Personal';
  showModal('personal', true);
};

// Generar código correlativo
function generarCodigoPersonal() {
  if (personal.length === 0) return '1';
  const codigos = personal.map(p => parseInt(p.codigo)).filter(c => !isNaN(c));
  if (codigos.length === 0) return '1';
  const maxCodigo = Math.max(...codigos);
  return String(maxCodigo + 1);
}

window.guardarPersonal = async function(e) {
  e.preventDefault();
  const codigoOriginal = document.getElementById('personal-codigo-original').value;
  const nombres = document.getElementById('personal-nombres').value.toUpperCase().trim();
  const dni = document.getElementById('personal-dni').value.trim();
  const area = document.getElementById('personal-area').value.toUpperCase().trim();
  
  if (!nombres || !dni || !area) {
    alert('Todos los campos son obligatorios');
    return;
  }
  
  const dniDuplicado = personal.find(p => p.dni === dni && p.codigo !== codigoOriginal);
  if (dniDuplicado) {
    alert('Ya existe una persona registrada con este DNI');
    return;
  }
  
  let codigoNuevo = codigoOriginal ? codigoOriginal : generarCodigoPersonal();
  
  const persona = {
    codigo: codigoNuevo,
    apellidosNombres: nombres,
    dni: dni,
    areaTrabajo: area
  };
  
  if (codigoOriginal) {
    const index = personal.findIndex(p => p.codigo === codigoOriginal);
    if (index >= 0) {
      personal[index] = { ...personal[index], ...persona };
    }
  } else {
    personal.push(persona);
  }
  
  await ipcRenderer.invoke('save-personal', personal);
  closeModal('personal');
  await renderView('personal');
  
  document.getElementById('personal-codigo-original').value = '';
  document.getElementById('personal-codigo').value = '';
  document.getElementById('personal-nombres').value = '';
  document.getElementById('personal-dni').value = '';
  document.getElementById('personal-area').value = '';
  document.getElementById('modal-titulo-personal').textContent = 'Nuevo Personal';
};

window.eliminarPersonal = async function(codigo) {
  if (confirm('¿Eliminar este registro?')) {
    personal = personal.filter(p => p.codigo !== codigo);
    await ipcRenderer.invoke('save-personal', personal);
    await renderView('personal');
  }
};

// Importar personal desde Excel
window.importarPersonalExcel = async function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const result = await ipcRenderer.invoke('import-excel-personal', buffer);
      if (result.success && result.personal && result.personal.length > 0) {
        await ipcRenderer.invoke('save-personal', result.personal);
        personal = result.personal;
        alert(`Importados ${personal.length} trabajadores`);
        await renderView('personal');
      } else {
        alert('No se encontraron registros válidos');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  input.click();
};

// Exportar personal a Excel
window.exportarPersonalExcel = async function() {
  if (personal.length === 0) {
    alert('No hay personal para exportar');
    return;
  }
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const datosExcel = personal.map(p => ({
      'CODIGO': p.codigo,
      'APELLIDOS Y NOMBRE': p.apellidosNombres || p.nombre,
      'DNI': p.dni,
      'AREA DE TRABAJO': p.areaTrabajo || p.area
    }));
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    XLSX.utils.book_append_sheet(wb, ws, 'Personal');
    const fecha = new Date().toISOString().split('T')[0];
    const wbJson = JSON.stringify(wb);
    const filePath = await ipcRenderer.invoke('export-excel', wbJson, `personal_${fecha}.xlsx`);
    if (filePath.startsWith('ERROR:')) {
      alert('Error al exportar: ' + filePath);
    } else {
      alert('Exportado a: ' + filePath);
    }
  } catch (err) {
    alert('Error al exportar: ' + err.message);
  }
};

// ================== COMIDA ==================
const PRECIO_COMIDA = 10;
const TOTAL_DIAS_CAMPANA = 14;
let comidaTrabajadorSeleccionado = null;

function renderComida(content) {
  let opcionesPersonal = '';
  if (personal && personal.length > 0) {
    opcionesPersonal = '<option value="">-- Seleccionar trabajador --</option>';
    for (let i = 0; i < personal.length; i++) {
      const p = personal[i];
      const info = getPersonalInfo(p);
      const selected = (comidaTrabajadorSeleccionado === p.codigo) ? 'selected' : '';
      opcionesPersonal += `<option value="${p.codigo}" ${selected}>${info.nombre} - ${info.area}</option>`;
    }
  } else {
    opcionesPersonal = '<option value="">No hay personal registrado</option>';
  }
  
  // Obtener el código seleccionado (del dropdown o de la variable)
  const codigoSeleccionado = comidaTrabajadorSeleccionado || 
    (personal.length > 0 ? personal[0].codigo : '');
  
  // Verificar si hay un trabajador seleccionado para mostrar el calendario
  const haySeleccion = codigoSeleccionado && codigoSeleccionado !== '';
  
  // Obtener consumos del trabajador seleccionado
  const consumosActual = haySeleccion ? getConsumosParaCodigo(codigoSeleccionado) : [];
  
  // Construir headers del calendario
  let headerDias = '<th style="padding:8px; text-align:center; min-width:50px; background:#f0f0f0">Tipo</th>';
  let botonesDias = '<td style="background:#f0f0f0"></td>';
  for (let d = 1; d <= TOTAL_DIAS_CAMPANA; d++) {
    headerDias += `<th style="padding:8px; text-align:center; font-size:0.85rem; background:#f0f0f0">D${d}</th>`;
    botonesDias += `<td style="text-align:center; padding:3px; background:#f8f8f8">
      <button onclick="seleccionarTodoDia(${d})" style="font-size:0.65rem; padding:1px 3px; background:#28a745; color:white; border:none; border-radius:2px; cursor:pointer" title="Marcar todo">☑</button>
      <button onclick="limpiarDia(${d})" style="font-size:0.65rem; padding:1px 3px; background:#dc3545; color:white; border:none; border-radius:2px; cursor:pointer" title="Limpiar">✕</button>
    </td>`;
  }
  
  // Calcular resumen para el trabajador seleccionado
  let resumenHTML = '';
  if (haySeleccion) {
    const trab = personal.find(p => p.codigo === codigoSeleccionado);
    const info = trab ? getPersonalInfo(trab) : { nombre: '-', area: '-' };
    const totales = calcularTotalesComida(consumosActual);
    resumenHTML = `
      <div id="resumen-comida-trabajador" style="margin-top:15px; padding:15px; background:#e8f5e9; border-radius:8px">
        <h4>📊 ${info.nombre}</h4>
        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-top:10px">
          <div style="background:white; padding:10px 15px; border-radius:5px; text-align:center; min-width:80px">
            <div style="font-size:1.3rem">☕</div>
            <div style="font-size:0.8rem; color:#666">Desayunos</div>
            <div style="font-size:1.2rem; font-weight:bold; color:#fd7e14">${totales.desayunos}</div>
            <div style="color:#666; font-size:0.8rem">S/ ${totales.desayunos * PRECIO_COMIDA}</div>
          </div>
          <div style="background:white; padding:10px 15px; border-radius:5px; text-align:center; min-width:80px">
            <div style="font-size:1.3rem">🍱</div>
            <div style="font-size:0.8rem; color:#666">Almuerzos</div>
            <div style="font-size:1.2rem; font-weight:bold; color:#28a745">${totales.almuerzos}</div>
            <div style="color:#666; font-size:0.8rem">S/ ${totales.almuerzos * PRECIO_COMIDA}</div>
          </div>
          <div style="background:white; padding:10px 15px; border-radius:5px; text-align:center; min-width:80px">
            <div style="font-size:1.3rem">🌙</div>
            <div style="font-size:0.8rem; color:#666">Cenas</div>
            <div style="font-size:1.2rem; font-weight:bold; color:#6f42c1">${totales.cenas}</div>
            <div style="color:#666; font-size:0.8rem">S/ ${totales.cenas * PRECIO_COMIDA}</div>
          </div>
          <div style="background:#007bff; color:white; padding:10px 15px; border-radius:5px; text-align:center; min-width:80px">
            <div style="font-size:0.8rem">Total</div>
            <div style="font-size:1.3rem; font-weight:bold">${totales.total}</div>
            <div style="font-size:0.8rem">S/ ${totales.total * PRECIO_COMIDA}</div>
          </div>
        </div>
        <div style="margin-top:10px; font-size:0.9rem; color:#666">
          <strong>${totales.total}/42</strong> comidas usadas
          <div style="width:200px; height:8px; background:#ddd; border-radius:5px; margin-top:5px">
            <div style="width:${Math.min((totales.total / 42) * 100, 100)}%; height:100%; background:#007bff; border-radius:5px; transition:width 0.3s"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Generar filas de la tabla (Desayuno, Almuerzo, Cena)
  let filasTabla = '';
  const tiposComida = [
    { key: 'desayuno', icono: '☕', label: 'Desayuno', color: '#fd7e14' },
    { key: 'almuerzo', icono: '🍱', label: 'Almuerzo', color: '#28a745' },
    { key: 'cena', icono: '🌙', label: 'Cena', color: '#6f42c1' }
  ];
  
  tiposComida.forEach(tipo => {
    filasTabla += `<tr>
      <td style="padding:10px; font-weight:bold; color:${tipo.color}; background:#fafafa; border:1px solid #ddd">${tipo.icono} ${tipo.label}</td>`;
    for (let d = 1; d <= TOTAL_DIAS_CAMPANA; d++) {
      const marcada = consumosActual.some(c => c.dia === d && c[tipo.key]);
      filasTabla += `<td style="text-align:center; padding:4px; background:white; border:1px solid #eee">
        <div id="celda-${codigoSeleccionado}-${d}-${tipo.key}" onclick="toggleComida('${codigoSeleccionado}', ${d}, '${tipo.key}')" 
          style="width:30px; height:30px; border-radius:5px; cursor:pointer; margin:0 auto; 
          background:${marcada ? tipo.color : '#f0f0f0'}; 
          color:${marcada ? 'white' : '#ccc'};
          display:flex; align-items:center; justify-content:center;
          font-size:1rem; transition:all 0.2s; border:1px solid ${marcada ? tipo.color : '#ddd'}"
          title="Día ${d} - ${tipo.label}">
          ${marcada ? '✓' : ''}
        </div>
      </td>`;
    }
    filasTabla += '</tr>';
  });
  
  // Generar filas para TODOS los trabajadores (resumen general)
  let filasResumenGeneral = '';
  personal.forEach(p => {
    const info = getPersonalInfo(p);
    const consumos = getConsumosParaCodigo(p.codigo);
    const totales = calcularTotalesComida(consumos);
    filasResumenGeneral += `<tr style="background:${codigoSeleccionado === p.codigo ? '#e8f5e9' : 'white'}">
      <td style="padding:8px; border:1px solid #eee">${info.nombre}</td>
      <td style="text-align:center; color:#fd7e14; font-weight:bold; border:1px solid #eee">${totales.desayunos}</td>
      <td style="text-align:center; color:#28a745; font-weight:bold; border:1px solid #eee">${totales.almuerzos}</td>
      <td style="text-align:center; color:#6f42c1; font-weight:bold; border:1px solid #eee">${totales.cenas}</td>
      <td style="text-align:center; font-weight:bold; border:1px solid #eee">${totales.total}</td>
      <td style="text-align:center; border:1px solid #eee">S/ ${totales.total * PRECIO_COMIDA}</td>
    </tr>`;
  });
  
  // Totales generales
  const totalesGenerales = personal.reduce((acc, p) => {
    const consumos = getConsumosParaCodigo(p.codigo);
    const t = calcularTotalesComida(consumos);
    acc.desayunos += t.desayunos;
    acc.almuerzos += t.almuerzos;
    acc.cenas += t.cenas;
    acc.total += t.total;
    return acc;
  }, { desayunos: 0, almuerzos: 0, cenas: 0, total: 0 });
  
  // Mensaje cuando no hay selección
  let mensajeNoSeleccion = '';
  if (!haySeleccion) {
    mensajeNoSeleccion = '<div style="padding:40px; text-align:center; color:#666; background:#f9f9f9; border-radius:8px; margin-top:20px"><p style="font-size:1.1rem">👆 Seleccione un trabajador del dropdown para ver el calendario</p></div>';
  }
  
  content.innerHTML = `
    <div class="card">
      <h3>🍽️ Registro de Comida</h3>
      <p style="color:#666; margin-bottom:20px">Campaña de 14 días - S/ ${PRECIO_COMIDA} por comida</p>
      
      <div class="form-group">
        <label>Seleccionar Trabajador</label>
        <select id="comida-trabajador" onchange="cargarConsumosTrabajador()" style="width:100%; padding:12px; border:2px solid #ddd; border-radius:5px; font-size:1rem; background:white">
          ${opcionesPersonal}
        </select>
      </div>
      
      ${mensajeNoSeleccion}
      
      <div id="seccion-calendario" style="margin-top:20px; display:${haySeleccion ? 'block' : 'none'}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
          <h4 style="margin:0">📅 Calendario de 14 días</h4>
          <span style="font-size:0.85rem; color:#666">Click en cada celda para marcar/desmarcar</span>
        </div>
        
        <div style="overflow-x:auto; max-width:100%">
          <table style="border-collapse:collapse; min-width:600px; font-size:0.9rem; border:1px solid #ccc">
            <thead>
              <tr style="background:#f0f0f0">
                ${headerDias}
              </tr>
              <tr style="background:#f8f8f8; font-size:0.75rem">
                ${botonesDias}
              </tr>
            </thead>
            <tbody>
              ${filasTabla}
            </tbody>
          </table>
        </div>
        
        ${resumenHTML}
        
        <div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap">
          <button onclick="guardarConsumosComida()" class="btn btn-primary" style="padding:12px 24px; font-size:1rem">
            💾 Guardar Cambios
          </button>
          <span id="estado-guardado" style="color:#28a745; font-size:0.9rem; display:none; align-self:center">✓ Guardado</span>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h3>📊 Resumen General de Comida</h3>
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card" style="background:#fff3cd">
          <h3 style="color:#fd7e14">☕ ${totalesGenerales.desayunos}</h3>
          <p>Desayunos</p>
        </div>
        <div class="stat-card" style="background:#d4edda">
          <h3 style="color:#28a745">🍱 ${totalesGenerales.almuerzos}</h3>
          <p>Almuerzos</p>
        </div>
        <div class="stat-card" style="background:#e2e3e5">
          <h3 style="color:#6f42c1">🌙 ${totalesGenerales.cenas}</h3>
          <p>Cenas</p>
        </div>
        <div class="stat-card">
          <h3>${totalesGenerales.total}</h3>
          <p>Total Comidas</p>
        </div>
        <div class="stat-card" style="background:#007bff; color:white">
          <h3>S/ ${totalesGenerales.total * PRECIO_COMIDA}</h3>
          <p>Total Cobrar</p>
        </div>
      </div>
      
      <table style="font-size:0.9rem">
        <thead>
          <tr style="background:var(--primary); color:white">
            <th style="padding:10px; text-align:left">Trabajador</th>
            <th style="padding:10px; text-align:center">☕ Desayuno</th>
            <th style="padding:10px; text-align:center">🍱 Almuerzo</th>
            <th style="padding:10px; text-align:center">🌙 Cena</th>
            <th style="padding:10px; text-align:center">Total</th>
            <th style="padding:10px; text-align:center">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${filasResumenGeneral || '<tr><td colspan="6" style="text-align:center; padding:20px">No hay personal registrado</td></tr>'}
        </tbody>
        <tfoot>
          <tr style="background:#e9ecef; font-weight:bold">
            <td style="padding:10px">TOTAL</td>
            <td style="text-align:center; color:#fd7e14">${totalesGenerales.desayunos}</td>
            <td style="text-align:center; color:#28a745">${totalesGenerales.almuerzos}</td>
            <td style="text-align:center; color:#6f42c1">${totalesGenerales.cenas}</td>
            <td style="text-align:center">${totalesGenerales.total}</td>
            <td style="text-align:center">S/ ${totalesGenerales.total * PRECIO_COMIDA}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// Obtener estructura de consumos para un código
function getConsumosParaCodigo(codigo) {
  const registro = consumosComida.find(c => c.codigo === codigo);
  if (!registro) {
    // Crear estructura vacía para 14 días
    const dias = [];
    for (let d = 1; d <= TOTAL_DIAS_CAMPANA; d++) {
      dias.push({ dia: d, desayuno: false, almuerzo: false, cena: false });
    }
    return dias;
  }
  // Asegurar que tenga los 14 días
  const diasExistentes = registro.dias || [];
  const dias = [];
  for (let d = 1; d <= TOTAL_DIAS_CAMPANA; d++) {
    const existente = diasExistentes.find(x => x.dia === d);
    if (existente) {
      dias.push(existente);
    } else {
      dias.push({ dia: d, desayuno: false, almuerzo: false, cena: false });
    }
  }
  return dias;
}

// Calcular totales de comida
function calcularTotalesComida(dias) {
  return dias.reduce((acc, d) => {
    if (d.desayuno) acc.desayunos++;
    if (d.almuerzo) acc.almuerzos++;
    if (d.cena) acc.cenas++;
    return acc;
  }, { desayunos: 0, almuerzos: 0, cenas: 0, total: 0 });
}

// Marcar/desmarcar una comida
window.toggleComida = function(codigo, dia, tipo) {
  if (!codigo || codigo === '') return;
  
  const index = consumosComida.findIndex(c => c.codigo === codigo);
  if (index < 0) {
    // Crear nuevo registro con todos los días vacíos y solo marcar el actual
    const dias = [];
    for (let d = 1; d <= TOTAL_DIAS_CAMPANA; d++) {
      dias.push({ 
        dia: d, 
        desayuno: d === dia && tipo === 'desayuno',
        almuerzo: d === dia && tipo === 'almuerzo', 
        cena: d === dia && tipo === 'cena' 
      });
    }
    consumosComida.push({ codigo: codigo, dias: dias });
  } else {
    // Encontrar el día en el registro existente
    let diaRegistro = consumosComida[index].dias.find(d => d.dia === dia);
    if (!diaRegistro) {
      // Crear el día si no existe
      consumosComida[index].dias.push({ dia: dia, desayuno: false, almuerzo: false, cena: false });
      diaRegistro = consumosComida[index].dias.find(d => d.dia === dia);
    }
    if (diaRegistro) {
      // Toggle del tipo específico
      diaRegistro[tipo] = !diaRegistro[tipo];
    }
  }
  
  // Actualizar SOLO la celda clicked (sin re-renderizar todo)
  actualizarCeldaComida(codigo, dia, tipo);
  
  // También actualizar el resumen y la barra de progreso
  actualizarResumenComida(codigo);
};

// Actualizar SOLO una celda específica (no todo el calendario)
function actualizarCeldaComida(codigo, dia, tipo) {
  const celda = document.getElementById(`celda-${codigo}-${dia}-${tipo}`);
  if (!celda) return;
  
  // Obtener el estado actual del consumo
  const consumos = getConsumosParaCodigo(codigo);
  const diaData = consumos.find(d => d.dia === dia);
  const marcada = diaData && diaData[tipo];
  
  // Colores por tipo
  const colores = { 
    desayuno: '#fd7e14', 
    almuerzo: '#28a745', 
    cena: '#6f42c1' 
  };
  
  celda.style.background = marcada ? colores[tipo] : '#f0f0f0';
  celda.style.color = marcada ? 'white' : '#ccc';
  celda.style.borderColor = marcada ? colores[tipo] : '#ddd';
  celda.innerHTML = marcada ? '✓' : '';
}

// Actualizar SOLO el resumen de un trabajador
function actualizarResumenComida(codigo) {
  const resumenDiv = document.getElementById('resumen-comida-trabajador');
  if (!resumenDiv) return;
  
  const trab = personal.find(p => p.codigo === codigo);
  if (!trab) return;
  
  const info = getPersonalInfo(trab);
  const consumos = getConsumosParaCodigo(codigo);
  const totales = calcularTotalesComida(consumos);
  
  resumenDiv.innerHTML = `
    <h4>📊 ${info.nombre}</h4>
    <div style="display:flex; gap:15px; flex-wrap:wrap; margin-top:10px">
      <div style="background:white; padding:10px 15px; border-radius:5px; text-align:center; min-width:80px">
        <div style="font-size:1.3rem">☕</div>
        <div style="font-size:0.8rem; color:#666">Desayunos</div>
        <div style="font-size:1.2rem; font-weight:bold; color:#fd7e14">${totales.desayunos}</div>
        <div style="color:#666; font-size:0.8rem">S/ ${totales.desayunos * PRECIO_COMIDA}</div>
      </div>
      <div style="background:white; padding:10px 15px; border-radius:5px; text-align:center; min-width:80px">
        <div style="font-size:1.3rem">🍱</div>
        <div style="font-size:0.8rem; color:#666">Almuerzos</div>
        <div style="font-size:1.2rem; font-weight:bold; color:#28a745">${totales.almuerzos}</div>
        <div style="color:#666; font-size:0.8rem">S/ ${totales.almuerzos * PRECIO_COMIDA}</div>
      </div>
      <div style="background:white; padding:10px 15px; border-radius:5px; text-align:center; min-width:80px">
        <div style="font-size:1.3rem">🌙</div>
        <div style="font-size:0.8rem; color:#666">Cenas</div>
        <div style="font-size:1.2rem; font-weight:bold; color:#6f42c1">${totales.cenas}</div>
        <div style="color:#666; font-size:0.8rem">S/ ${totales.cenas * PRECIO_COMIDA}</div>
      </div>
      <div style="background:#007bff; color:white; padding:10px 15px; border-radius:5px; text-align:center; min-width:80px">
        <div style="font-size:0.8rem">Total</div>
        <div style="font-size:1.3rem; font-weight:bold">${totales.total}</div>
        <div style="font-size:0.8rem">S/ ${totales.total * PRECIO_COMIDA}</div>
      </div>
    </div>
    <div style="margin-top:10px; font-size:0.9rem; color:#666">
      <strong>${totales.total}/42</strong> comidas usadas
      <div style="width:200px; height:8px; background:#ddd; border-radius:5px; margin-top:5px">
        <div style="width:${Math.min((totales.total / 42) * 100, 100)}%; height:100%; background:#007bff; border-radius:5px; transition:width 0.3s"></div>
      </div>
    </div>
  `;
}

// Seleccionar todo un día (3 comidas)
window.seleccionarTodoDia = function(dia) {
  const codigo = document.getElementById('comida-trabajador').value;
  if (!codigo) {
    alert('Seleccione un trabajador primero');
    return;
  }
  
  const index = consumosComida.findIndex(c => c.codigo === codigo);
  if (index < 0) {
    // Crear nuevo registro con el día completo seleccionado
    const dias = [];
    for (let d = 1; d <= TOTAL_DIAS_CAMPANA; d++) {
      dias.push({ 
        dia: d, 
        desayuno: d === dia,
        almuerzo: d === dia, 
        cena: d === dia 
      });
    }
    consumosComida.push({ codigo: codigo, dias: dias });
  } else {
    // Buscar o crear el día
    let diaIndex = consumosComida[index].dias.findIndex(d => d.dia === dia);
    if (diaIndex < 0) {
      consumosComida[index].dias.push({ dia: dia, desayuno: false, almuerzo: false, cena: false });
      diaIndex = consumosComida[index].dias.findIndex(d => d.dia === dia);
    }
    if (diaIndex >= 0) {
      consumosComida[index].dias[diaIndex].desayuno = true;
      consumosComida[index].dias[diaIndex].almuerzo = true;
      consumosComida[index].dias[diaIndex].cena = true;
    }
  }
  
  // Actualizar las 3 celdas del día
  ['desayuno', 'almuerzo', 'cena'].forEach(tipo => {
    actualizarCeldaComida(codigo, dia, tipo);
  });
  
  // Actualizar resumen
  actualizarResumenComida(codigo);
};

// Limpiar un día (quitar las 3 comidas)
window.limpiarDia = function(dia) {
  const codigo = document.getElementById('comida-trabajador').value;
  if (!codigo) return;
  
  const index = consumosComida.findIndex(c => c.codigo === codigo);
  if (index >= 0) {
    const diaIndex = consumosComida[index].dias.findIndex(d => d.dia === dia);
    if (diaIndex >= 0) {
      consumosComida[index].dias[diaIndex].desayuno = false;
      consumosComida[index].dias[diaIndex].almuerzo = false;
      consumosComida[index].dias[diaIndex].cena = false;
    }
  }
  
  // Actualizar las 3 celdas del día
  ['desayuno', 'almuerzo', 'cena'].forEach(tipo => {
    actualizarCeldaComida(codigo, dia, tipo);
  });
  
  // Actualizar resumen
  actualizarResumenComida(codigo);
};

// Cargar consumos al cambiar trabajador
window.cargarConsumosTrabajador = function() {
  const codigo = document.getElementById('comida-trabajador').value;
  comidaTrabajadorSeleccionado = codigo;
  
  if (codigo) {
    // Mostrar calendario y guardar selección
    const seccionCalendario = document.getElementById('seccion-calendario');
    if (seccionCalendario) {
      seccionCalendario.style.display = 'block';
    }
    // Renderizar el calendario para el trabajador seleccionado
    renderView('comida');
  }
};

// Guardar consumos de comida
window.guardarConsumosComida = async function() {
  await ipcRenderer.invoke('save-consumos-comida', consumosComida);
  alert('✅ Cambios guardados correctamente');
  renderView('comida');
};

// ================== VENTAS ==================
let personalVentaSeleccionado = null;
let productosVentaSeleccionados = [];

function renderVentas(content) {
  let opcionesPersonal = '';
  if (personal && personal.length > 0) {
    opcionesPersonal = '<option value="">-- Seleccionar trabajador --</option>';
    for (let i = 0; i < personal.length; i++) {
      const p = personal[i];
      const info = getPersonalInfo(p);
      opcionesPersonal += '<option value="' + p.codigo + '">' + p.codigo + ' - ' + info.nombre + ' - ' + info.area + '</option>';
    }
  } else {
    opcionesPersonal = '<option value="">No hay personal cargado</option>';
  }
  
  content.innerHTML = `
    <div class="card">
      <h3>🛒 Nueva Venta (Fiado)</h3>
      <div class="form-group">
        <label>Seleccionar Trabajador</label>
        <select id="select-personal-venta" onchange="seleccionarPersonalVenta(this.value)" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px; font-size:1rem">
          ${opcionesPersonal}
        </select>
      </div>
      <div id="trabajador-seleccionado" style="display:none; background:#e8f5e9; padding:15px; border-radius:8px; margin:15px 0">
        <p><strong>Trabajador:</strong> <span id="trabajador-nombre"></span></p>
        <p><strong>Deuda Actual:</strong> S/ <span id="trabajador-deuda"></span></p>
      </div>
      <div id="seccion-productos" style="display:none">
        <h4>Productos</h4>
        <div class="productos-grid">
          ${productos.filter(p => p.stock > 0).map(p => `
            <div class="producto-card" data-sku="${p.sku}" onclick="seleccionarProductoVenta('${p.sku}')">
              <h4>${p.nombre}</h4>
              <p>Stock: ${p.stock}</p>
              <p>S/ ${(p.precioVenta || 0).toFixed(2)}</p>
            </div>
          `).join('') || '<p>No hay productos en stock</p>'}
        </div>
        <div id="resumen-venta" style="margin-top:20px; background:#f7fafc; padding:20px; border-radius:8px">
          <p style="color:#666">Ningún producto seleccionado</p>
        </div>
        <button class="btn btn-success" style="margin-top:15px" onclick="confirmarVenta()" id="btn-confirmar-venta" disabled>Confirmar Venta</button>
      </div>
    </div>
    <div class="card">
      <h3>Historial de Ventas</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Trabajador</th><th>Total</th></tr></thead>
        <tbody>
          ${ventas.slice().reverse().map(v => `<tr><td>${v.fecha}</td><td>${v.clienteNombre}</td><td>S/ ${v.total.toFixed(2)}</td></tr>`).join('') || '<tr><td colspan="3">No hay ventas</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

window.seleccionarPersonalVenta = function(codigo) {
  if (!codigo) {
    document.getElementById('trabajador-seleccionado').style.display = 'none';
    document.getElementById('seccion-productos').style.display = 'none';
    personalVentaSeleccionado = null;
    return;
  }
  
  personalVentaSeleccionado = codigo;
  const trab = personal.find(p => p.codigo === codigo);
  if (!trab) { alert('Trabajador no encontrado'); return; }
  
  document.getElementById('trabajador-seleccionado').style.display = 'block';
  document.getElementById('trabajador-nombre').textContent = trab.codigo + ' - ' + trab.apellidosNombres + ' - ' + trab.areaTrabajo;
  document.getElementById('trabajador-deuda').textContent = calcularDeudaPersonal(codigo).toFixed(2);
  productosVentaSeleccionados = [];
  document.getElementById('seccion-productos').style.display = 'block';
  actualizarResumenVenta();
};

window.seleccionarProductoVenta = function(sku) {
  const producto = productos.find(p => p.sku === sku);
  if (!producto || producto.stock === 0) { alert('Producto sin stock'); return; }
  const index = productosVentaSeleccionados.findIndex(p => p.sku === sku);
  if (index >= 0) { 
    // Si ya existe, aumentar cantidad en 1
    if (productosVentaSeleccionados[index].cantidad < producto.stock) {
      productosVentaSeleccionados[index].cantidad += 1;
    } else {
      alert('Stock máximo alcanzado');
    }
  } else { 
    // Si no existe, agregar con cantidad 1
    productosVentaSeleccionados.push({ sku: sku, cantidad: 1, precioVenta: producto.precioVenta || 0 });
  }
  actualizarResumenVenta();
};

window.actualizarResumenVenta = function() {
  const container = document.getElementById('resumen-venta');
  const btnConfirmar = document.getElementById('btn-confirmar-venta');
  if (productosVentaSeleccionados.length === 0) {
    container.innerHTML = '<p style="color:#666">Ningún producto seleccionado</p>';
    btnConfirmar.disabled = true;
    return;
  }
  let html = '<table style="width:100%"><thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead><tbody>';
  let total = 0;
  productosVentaSeleccionados.forEach((p, index) => {
    const prod = productos.find(pr => pr.sku === p.sku);
    const precioVenta = prod ? (prod.precioVenta || 0) : 0;
    const subtotal = p.cantidad * precioVenta;
    total += subtotal;
    html += `<tr>
      <td>${prod ? prod.nombre : p.sku}</td>
      <td>
        <input type="number" min="1" max="${prod ? prod.stock : 999}" value="${p.cantidad}" 
          onchange="cambiarCantidadVenta(${index}, this.value)" 
          style="width:60px; padding:5px; border:1px solid #ddd; border-radius:4px; text-align:center">
      </td>
      <td>S/ ${precioVenta.toFixed(2)}</td>
      <td><strong>S/ ${subtotal.toFixed(2)}</strong></td>
      <td><button onclick="quitarProductoVenta(${index})" style="background:#dc3545; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer">✕</button></td>
    </tr>`;
  });
  html += `<tr><td colspan="3"><strong>TOTAL</strong></td><td colspan="2"><strong style="font-size:1.2rem">S/ ${total.toFixed(2)}</strong></td></tr></tbody></table>`;
  container.innerHTML = html;
  btnConfirmar.disabled = false;
};

// Cambiar cantidad desde el input
window.cambiarCantidadVenta = function(index, nuevaCantidad) {
  const cant = parseInt(nuevaCantidad);
  if (isNaN(cant) || cant < 1) {
    alert('Cantidad inválida');
    actualizarResumenVenta();
    return;
  }
  const prod = productos.find(p => p.sku === productosVentaSeleccionados[index].sku);
  if (prod && cant > prod.stock) {
    alert('No hay suficiente stock. Disponible: ' + prod.stock);
    actualizarResumenVenta();
    return;
  }
  productosVentaSeleccionados[index].cantidad = cant;
  actualizarResumenVenta();
};

// Quitar producto de la venta
window.quitarProductoVenta = function(index) {
  productosVentaSeleccionados.splice(index, 1);
  actualizarResumenVenta();
};

window.confirmarVenta = async function() {
  if (!personalVentaSeleccionado || productosVentaSeleccionados.length === 0) { alert('Seleccione un trabajador y al menos un producto'); return; }
  const trab = personal.find(p => p.codigo === personalVentaSeleccionado);
  let total = 0;
  const items = productosVentaSeleccionados.map(p => {
    const prod = productos.find(pr => pr.sku === p.sku);
    const precioVenta = prod ? (prod.precioVenta || 0) : 0;
    total += p.cantidad * precioVenta;
    return { sku: p.sku, cantidad: p.cantidad, precioVenta: precioVenta };
  });
  const venta = { id: Date.now(), fecha: new Date().toLocaleDateString('es'), clienteCodigo: personalVentaSeleccionado, clienteNombre: trab.apellidosNombres, items: items, total: total };
  ventas.push(venta);
  await ipcRenderer.invoke('save-ventas', ventas);
  productosVentaSeleccionados = [];
  personalVentaSeleccionado = null;
  renderView('ventas');
  alert('Venta registrada');
};

// ================== DEUDAS ==================
function renderDeudas(content) {
  const deudores = getDeudores();
  
  // Calcular totales generales
  const totalCompras = ventas.reduce((s, v) => s + v.total, 0);
  const totalComida = personal.reduce((sum, p) => sum + calcularCostoComidaPersonal(p.codigo), 0);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  
  content.innerHTML = `
    <div class="card">
      <h3>📋 Control de Deudas</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>${deudores.length}</h3>
          <p>Personal con Deuda</p>
        </div>
        <div class="stat-card" style="background:#fef3c7">
          <h3 style="color:var(--primary)">S/ ${totalCompras.toFixed(2)}</h3>
          <p>Total Compras</p>
        </div>
        <div class="stat-card" style="background:#fff3cd">
          <h3 style="color:#fd7e14">S/ ${totalComida.toFixed(2)}</h3>
          <p>Total Comida</p>
        </div>
        <div class="stat-card" style="background:#d4edda">
          <h3 style="color:#28a745">S/ ${totalPagos.toFixed(2)}</h3>
          <p>Total Pagos</p>
        </div>
        <div class="stat-card" style="background:#dc3545; color:white">
          <h3>S/ ${calcularDeudaTotal().toFixed(2)}</h3>
          <p>Deuda Total</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr style="background:var(--primary); color:white">
            <th style="padding:10px; text-align:left">Nombre</th>
            <th style="padding:10px; text-align:center">Compras</th>
            <th style="padding:10px; text-align:center">Comida</th>
            <th style="padding:10px; text-align:center">Pagos</th>
            <th style="padding:10px; text-align:center">Deuda Total</th>
            <th style="padding:10px; text-align:center">Acción</th>
          </tr>
        </thead>
        <tbody>
          ${deudores.map(p => { 
            const info = getPersonalInfo(p);
            const detalle = getDetalleDeuda(p.codigo);
            return `
            <tr>
              <td style="padding:10px">
                <strong>${info.nombre}</strong><br>
                <span style="color:#666; font-size:0.85rem">${info.area}</span>
              </td>
              <td style="text-align:center">S/ ${detalle.compras.toFixed(2)}</td>
              <td style="text-align:center; color:#fd7e14">S/ ${detalle.comida.toFixed(2)}</td>
              <td style="text-align:center; color:#28a745">S/ ${detalle.pagos.toFixed(2)}</td>
              <td style="text-align:center; font-weight:bold; color:#dc3545">S/ ${detalle.total.toFixed(2)}</td>
              <td style="text-align:center"><button class="btn btn-success" onclick="registrarPago('${p.codigo}')">💵 Pagar</button></td>
            </tr>
          `; }).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px">No hay deudas</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

window.registrarPago = function(codigo) {
  const trab = personal.find(p => p.codigo === codigo);
  const detalle = getDetalleDeuda(codigo);
  document.getElementById('pago-personal-codigo').value = codigo;
  document.getElementById('form-pago').childNodes[0].innerHTML = `
    <strong>Trabajador:</strong> ${trab.apellidosNombres}<br>
    <span style="font-size:0.9rem; color:#666">
      Compras: S/ ${detalle.compras.toFixed(2)} | 
      Comida: S/ ${detalle.comida.toFixed(2)} | 
      Pagos: S/ ${detalle.pagos.toFixed(2)}
    </span><br>
    <strong style="color:#dc3545">Deuda Total: S/ ${detalle.total.toFixed(2)}</strong>
  `;
  showModal('pago');
};

window.guardarPago = async function(e) {
  e.preventDefault();
  const form = e.target;
  const pago = { id: Date.now(), fecha: new Date().toLocaleDateString('es'), clienteCodigo: form.codigo.value, monto: parseFloat(form.monto.value) };
  pagos.push(pago);
  await ipcRenderer.invoke('save-pagos', pagos);
  closeModal('pago');
  renderView('deudas');
  alert('Pago registrado');
};

// ================== REPORTES ==================
function renderReportes(content) {
  const totalIngresos = ventas.reduce((s, v) => s + v.total, 0);
  const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
  const deudaTotal = calcularDeudaTotal();
  
  // Calcular totales de comida con nuevo formato
  const totalesComida = personal.reduce((acc, p) => {
    const consumos = getConsumosParaCodigo(p.codigo);
    const t = calcularTotalesComida(consumos);
    acc.desayunos += t.desayunos;
    acc.almuerzos += t.almuerzos;
    acc.cenas += t.cenas;
    acc.total += t.total;
    return acc;
  }, { desayunos: 0, almuerzos: 0, cenas: 0, total: 0 });
  const totalComidaCosto = totalesComida.total * PRECIO_COMIDA;
  
  content.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px">
        <h3>📈 Reportes Detallados por Colaborador</h3>
        <div style="display:flex; gap:10px">
          <button class="btn btn-primary" onclick="exportarReporteExcel()">📥 Exportar Reporte a Excel</button>
          <button class="btn btn-danger" onclick="mostrarConfirmacionCierreCampana()" style="padding:10px 20px; font-size:0.95rem">🚫 Cerrar Campaña</button>
        </div>
      </div>
      
      <!-- Resumen General -->
      <div class="stats-grid" style="margin-bottom:25px">
        <div class="stat-card">
          <h3>${personal.length}</h3>
          <p>Total Colaboradores</p>
        </div>
        <div class="stat-card">
          <h3>S/ ${totalIngresos.toFixed(2)}</h3>
          <p>Total Compras (Fiado)</p>
        </div>
        <div class="stat-card">
          <h3 style="color: var(--success)">S/ ${totalPagos.toFixed(2)}</h3>
          <p>Total Pagos Recibidos</p>
        </div>
        <div class="stat-card">
          <h3 style="color: var(--accent)">S/ ${deudaTotal.toFixed(2)}</h3>
          <p>Deuda Pendiente</p>
        </div>
        <div class="stat-card" style="background:#fff3cd">
          <h3 style="color:#fd7e14">☕ ${totalesComida.desayunos}</h3>
          <p>Desayunos</p>
        </div>
        <div class="stat-card" style="background:#d4edda">
          <h3 style="color:#28a745">🍱 ${totalesComida.almuerzos}</h3>
          <p>Almuerzos</p>
        </div>
        <div class="stat-card" style="background:#e2e3e5">
          <h3 style="color:#6f42c1">🌙 ${totalesComida.cenas}</h3>
          <p>Cenas</p>
        </div>
        <div class="stat-card" style="background:#007bff; color:white">
          <h3>S/ ${totalComidaCosto.toFixed(2)}</h3>
          <p>Total Comida</p>
        </div>
      </div>
      
      <!-- Detalle por Colaborador -->
      <div style="margin-top:25px">
        <h4 style="margin-bottom:15px">📋 Desglose por Colaborador</h4>
        ${personal.length === 0 ? '<p style="color:#666">No hay colaboradores registrados</p>' : ''}
        
        ${personal.map(p => {
          const info = getPersonalInfo(p);
          const deuda = calcularDeudaPersonal(p.codigo);
          const misCompras = ventas.filter(v => v.clienteCodigo === p.codigo);
          const misPagos = pagos.filter(pa => pa.clienteCodigo === p.codigo);
          const misConsumos = getConsumosParaCodigo(p.codigo);
          const totalesPersona = calcularTotalesComida(misConsumos);
          
          // Calcular totales de este colaborador
          const totalCompras = misCompras.reduce((sum, v) => sum + v.total, 0);
          const totalPagosPersona = misPagos.reduce((sum, pa) => sum + pa.monto, 0);
          const costoComida = totalesPersona.total * PRECIO_COMIDA;
          
          return `
            <div style="border:1px solid #ddd; border-radius:8px; margin-bottom:15px; overflow:hidden">
              <div style="background:${deuda > 0 ? '#fef3c7' : '#e8f5e9'}; padding:15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer" onclick="toggleDetalleReporte('${p.codigo}')">
                <div>
                  <strong style="font-size:1.1rem">${info.nombre}</strong>
                  <span style="margin-left:15px; color:#666">${info.area}</span>
                  <span style="margin-left:15px; font-size:0.85rem; color:#888">Cód: ${p.codigo}</span>
                </div>
                <div style="text-align:right">
                  <div style="font-size:0.9rem; color:#666">Compras: <strong>S/ ${totalCompras.toFixed(2)}</strong> | Pagos: <strong style="color:green">S/ ${totalPagosPersona.toFixed(2)}</strong></div>
                  <div style="font-size:1rem; margin-top:5px">
                    <span style="background:#fd7e14; color:white; padding:4px 8px; border-radius:4px; margin-right:3px">☕ ${totalesPersona.desayunos}</span>
                    <span style="background:#28a745; color:white; padding:4px 8px; border-radius:4px; margin-right:3px">🍱 ${totalesPersona.almuerzos}</span>
                    <span style="background:#6f42c1; color:white; padding:4px 8px; border-radius:4px; margin-right:3px">🌙 ${totalesPersona.cenas}</span>
                    <span style="background:#007bff; color:white; padding:4px 8px; border-radius:4px; margin-right:5px">S/ ${costoComida.toFixed(2)}</span>
                    ${deuda > 0 ? `<span style="background:#dc3545; color:white; padding:4px 8px; border-radius:4px">Deuda: S/ ${deuda.toFixed(2)}</span>` : '<span style="background:#28a745; color:white; padding:4px 8px; border-radius:4px">✓ Al día</span>'}
                  </div>
                </div>
              </div>
              
              <!-- Detalle expandable -->
              <div id="detalle-reporte-${p.codigo}" style="display:none; padding:15px; background:#fafafa">
                <h5 style="margin-bottom:10px; border-bottom:1px solid #ddd; padding-bottom:5px">Detalle de Transacciones</h5>
                
                <!-- Compras -->
                <div style="margin-bottom:15px">
                  <h6 style="color:#007bff; margin-bottom:8px">🛒 Compras (${misCompras.length})</h6>
                  ${misCompras.length === 0 ? '<p style="color:#999; font-size:0.9rem">Sin compras registradas</p>' : ''}
                  <table style="width:100%; font-size:0.9rem; border-collapse:collapse">
                    <thead>
                      <tr style="background:#f0f0f0">
                        <th style="padding:6px; border:1px solid #ddd; text-align:left">Fecha</th>
                        <th style="padding:6px; border:1px solid #ddd; text-align:left">Productos</th>
                        <th style="padding:6px; border:1px solid #ddd; text-align:right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${misCompras.map(v => {
                        let productosDetalle = '';
                        if (v.items && v.items.length > 0) {
                          productosDetalle = v.items.map(i => {
                            const prod = productos.find(pr => pr.sku === i.sku);
                            return prod ? `${i.cantidad}x ${prod.nombre}` : i.sku;
                          }).join(', ');
                        } else if (v.descripcion) {
                          productosDetalle = v.descripcion;
                        }
                        return `<tr>
                          <td style="padding:5px; border:1px solid #ddd">${v.fecha}</td>
                          <td style="padding:5px; border:1px solid #ddd">${productosDetalle}</td>
                          <td style="padding:5px; border:1px solid #ddd; text-align:right">S/ ${v.total.toFixed(2)}</td>
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
                
                <!-- Pagos -->
                <div style="margin-bottom:15px">
                  <h6 style="color:#28a745; margin-bottom:8px">💵 Pagos Recibidos (${misPagos.length})</h6>
                  ${misPagos.length === 0 ? '<p style="color:#999; font-size:0.9rem">Sin pagos registrados</p>' : ''}
                  <table style="width:100%; font-size:0.9rem; border-collapse:collapse">
                    <thead>
                      <tr style="background:#f0f0f0">
                        <th style="padding:6px; border:1px solid #ddd; text-align:left">Fecha</th>
                        <th style="padding:6px; border:1px solid #ddd; text-align:right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${misPagos.map(pa => `<tr>
                        <td style="padding:5px; border:1px solid #ddd">${pa.fecha}</td>
                        <td style="padding:5px; border:1px solid #ddd; text-align:right; color:green">S/ ${pa.monto.toFixed(2)}</td>
                      </tr>`).join('')}
                    </tbody>
                  </table>
                </div>
                
                <!-- Comida detallada -->
                <div>
                  <h6 style="color:#fd7e14; margin-bottom:8px">🍽️ Registro de Comida</h6>
                  <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px">
                    <div style="background:#fff3cd; padding:8px 15px; border-radius:5px; text-align:center">
                      <div style="font-size:0.85rem">☕ Desayunos</div>
                      <div style="font-size:1.2rem; font-weight:bold; color:#fd7e14">${totalesPersona.desayunos}</div>
                    </div>
                    <div style="background:#d4edda; padding:8px 15px; border-radius:5px; text-align:center">
                      <div style="font-size:0.85rem">🍱 Almuerzos</div>
                      <div style="font-size:1.2rem; font-weight:bold; color:#28a745">${totalesPersona.almuerzos}</div>
                    </div>
                    <div style="background:#e2e3e5; padding:8px 15px; border-radius:5px; text-align:center">
                      <div style="font-size:0.85rem">🌙 Cenas</div>
                      <div style="font-size:1.2rem; font-weight:bold; color:#6f42c1">${totalesPersona.cenas}</div>
                    </div>
                  </div>
                  <p style="color:#666; font-size:0.9rem">Total: <strong>${totalesPersona.total} comidas</strong> = <strong>S/ ${costoComida.toFixed(2)}</strong></p>
                </div>
                
                <!-- Resumen del colaborador -->
                <div style="margin-top:15px; padding:10px; background:#e9ecef; border-radius:5px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px">
                  <span><strong>Total Compras:</strong> S/ ${totalCompras.toFixed(2)}</span>
                  <span><strong>Total Pagos:</strong> S/ ${totalPagosPersona.toFixed(2)}</span>
                  <span><strong>Costo Comida:</strong> S/ ${costoComida.toFixed(2)}</span>
                  <span><strong>Deuda Actual:</strong> S/ ${deuda.toFixed(2)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Toggle detalle de reporte
window.toggleDetalleReporte = function(codigo) {
  const detalle = document.getElementById('detalle-reporte-' + codigo);
  if (detalle) {
    detalle.style.display = detalle.style.display === 'none' ? 'block' : 'none';
  }
};

// Exportar reporte a Excel
window.exportarReporteExcel = async function() {
  if (personal.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    
    // hoja 1: Resumen por colaborador
    const resumenData = personal.map(p => {
      const info = getPersonalInfo(p);
      const deuda = calcularDeudaPersonal(p.codigo);
      const misCompras = ventas.filter(v => v.clienteCodigo === p.codigo);
      const misPagos = pagos.filter(pa => pa.clienteCodigo === p.codigo);
      const misConsumos = getConsumosParaCodigo(p.codigo);
      const totalesPersona = calcularTotalesComida(misConsumos);
      const totalCompras = misCompras.reduce((sum, v) => sum + v.total, 0);
      const totalPagosPersona = misPagos.reduce((sum, pa) => sum + pa.monto, 0);
      
      return {
        'CODIGO': p.codigo,
        'COLABORADOR': info.nombre,
        'AREA': info.area,
        'DNI': p.dni || '',
        'DESAYUNOS': totalesPersona.desayunos,
        'ALMUERZOS': totalesPersona.almuerzos,
        'CENAS': totalesPersona.cenas,
        'TOTAL_COMIDAS': totalesPersona.total,
        'COSTO_COMIDA': totalesPersona.total * PRECIO_COMIDA,
        'TOTAL_COMPRAS': totalCompras,
        'TOTAL_PAGOS': totalPagosPersona,
        'DEUDA_ACTUAL': deuda,
        'ESTADO': deuda > 0 ? 'CON DEUDA' : 'AL DÍA'
      };
    });
    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    
    // Hoja 2: Detalle de compras
    const comprasData = [];
    ventas.forEach(v => {
      if (v.items && v.items.length > 0) {
        v.items.forEach(item => {
          const prod = productos.find(pr => pr.sku === item.sku);
          comprasData.push({
            'FECHA': v.fecha,
            'CODIGO_COLABORADOR': v.clienteCodigo,
            'COLABORADOR': v.clienteNombre,
            'PRODUCTO': prod ? prod.nombre : item.sku,
            'CANTIDAD': item.cantidad,
            'PRECIO': item.precioVenta || 0,
            'SUBTOTAL': item.cantidad * (item.precioVenta || 0)
          });
        });
      }
    });
    const wsCompras = XLSX.utils.json_to_sheet(comprasData);
    XLSX.utils.book_append_sheet(wb, wsCompras, 'Compras');
    
    // Hoja 3: Pagos
    const pagosData = pagos.map(p => {
      const trab = personal.find(pe => pe.codigo === p.clienteCodigo);
      return {
        'FECHA': p.fecha,
        'CODIGO_COLABORADOR': p.clienteCodigo,
        'COLABORADOR': trab ? (trab.apellidosNombres || trab.nombre) : 'N/A',
        'MONTO': p.monto
      };
    });
    const wsPagos = XLSX.utils.json_to_sheet(pagosData);
    XLSX.utils.book_append_sheet(wb, wsPagos, 'Pagos');
    
    // Hoja 4: Comida detallada
    const comidaData = [];
    personal.forEach(p => {
      const misConsumos = getConsumosParaCodigo(p.codigo);
      const info = getPersonalInfo(p);
      misConsumos.forEach(dia => {
        if (dia.desayuno) {
          comidaData.push({
            'CODIGO': p.codigo,
            'COLABORADOR': info.nombre,
            'AREA': info.area,
            'DIA': dia.dia,
            'TIPO': 'Desayuno',
            'MONTO': PRECIO_COMIDA
          });
        }
        if (dia.almuerzo) {
          comidaData.push({
            'CODIGO': p.codigo,
            'COLABORADOR': info.nombre,
            'AREA': info.area,
            'DIA': dia.dia,
            'TIPO': 'Almuerzo',
            'MONTO': PRECIO_COMIDA
          });
        }
        if (dia.cena) {
          comidaData.push({
            'CODIGO': p.codigo,
            'COLABORADOR': info.nombre,
            'AREA': info.area,
            'DIA': dia.dia,
            'TIPO': 'Cena',
            'MONTO': PRECIO_COMIDA
          });
        }
      });
    });
    const wsComida = XLSX.utils.json_to_sheet(comidaData);
    XLSX.utils.book_append_sheet(wb, wsComida, 'Comida');
    
    // Exportar
    const fecha = new Date().toISOString().split('T')[0];
    const wbJson = JSON.stringify(wb);
    const filePath = await ipcRenderer.invoke('export-excel', wbJson, `reporte_colaboradores_${fecha}.xlsx`);
    if (filePath.startsWith('ERROR:')) {
      alert('Error al exportar: ' + filePath);
    } else {
      alert('✅ Reporte exportado a:\n' + filePath);
    }
  } catch (err) {
    alert('Error al exportar: ' + err.message);
  }
};

// ================== CIERRE DE CAMPAÑA ==================
window.mostrarConfirmacionCierreCampana = function() {
  // Primera confirmación
  if (!confirm('⚠️ ¿Está seguro de que desea CERRAR la campaña?\n\nSe exportarán todos los datos a archivos y se resetearán las secciones de Comida, Ventas, Deudas y Reportes.\n\n¿Desea continuar?')) {
    return;
  }
  
  // Segunda confirmación
  if (!confirm('🚫 ÚLTIMA ADVERTENCIA 🚫\n\nEsta acción NO se puede deshacer.\n\nTodos los datos de:\n- Comida\n- Ventas\n- Pagos (Deudas)\n\nserán eliminados y guardados en archivos de respaldo.\n\n¿CONFIRMA el cierre de campaña?')) {
    return;
  }
  
  // Ejecutar cierre
  ejecutarCierreCampana();
};

window.ejecutarCierreCampana = async function() {
  try {
    // Mostrar loading
    const confirmBtn = document.querySelector('button[onclick="mostrarConfirmacionCierreCampana()"]');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = '⏳ Procesando...';
    }
    
    // Llamar al backend para exportar y resetear
    const resultado = await ipcRenderer.invoke('cerrar-campana', {
      personal: personal,
      ventas: ventas,
      pagos: pagos,
      consumosComida: consumosComida,
      productos: productos,
      precioComida: PRECIO_COMIDA,
      totalDiasCampana: TOTAL_DIAS_CAMPANA
    });
    
    if (resultado.success) {
      // Resetear datos en memoria
      ventas = [];
      pagos = [];
      consumosComida = [];
      
      // Recargar vista
      renderView('reportes');
      
      alert('✅ CAMPANA CERRADA EXITOSAMENTE\n\n' +
        '📁 Archivos guardados:\n' +
        '- ' + resultado.jsonPath + '\n' +
        '- ' + resultado.excelPath + '\n\n' +
        'Las secciones de Comida, Ventas y Deudas han sido reseteadas.\n' +
        'El personal y productos se mantienen.');
    } else {
      alert('❌ Error al cerrar campaña: ' + resultado.error);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  } finally {
    // Restaurar botón
    const confirmBtn = document.querySelector('button[onclick="mostrarConfirmacionCierreCampana()"]');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '🚫 Cerrar Campaña';
    }
  }
};

// ================== FUNCIONES AUXILIARES ==================
// Calcular costo de comida para un trabajador
function calcularCostoComidaPersonal(codigo) {
  const consumos = getConsumosParaCodigo(codigo);
  const totales = calcularTotalesComida(consumos);
  return (totales.desayunos + totales.almuerzos + totales.cenas) * PRECIO_COMIDA;
}

function calcularDeudaPersonal(codigo) {
  const compras = ventas.filter(v => v.clienteCodigo === codigo);
  const pagosPersonal = pagos.filter(p => p.clienteCodigo === codigo);
  const totalCompras = compras.reduce((sum, v) => sum + v.total, 0);
  const totalPagos = pagosPersonal.reduce((sum, p) => sum + p.monto, 0);
  const costoComida = calcularCostoComidaPersonal(codigo);
  // Deuda = Compras + Comida - Pagos
  return Math.max(0, totalCompras + costoComida - totalPagos);
}

function calcularDeudaTotal() {
  return personal.reduce((sum, p) => sum + calcularDeudaPersonal(p.codigo), 0);
}

function getDeudores() {
  return personal.filter(p => calcularDeudaPersonal(p.codigo) > 0).sort((a, b) => calcularDeudaPersonal(b.codigo) - calcularDeudaPersonal(a.codigo));
}

// Función para desglosar deuda (compras, comida, pagos)
function getDetalleDeuda(codigo) {
  const compras = ventas.filter(v => v.clienteCodigo === codigo);
  const pagosPersonal = pagos.filter(p => p.clienteCodigo === codigo);
  const totalCompras = compras.reduce((sum, v) => sum + v.total, 0);
  const totalPagos = pagosPersonal.reduce((sum, p) => sum + p.monto, 0);
  const costoComida = calcularCostoComidaPersonal(codigo);
  const deudaTotal = Math.max(0, totalCompras + costoComida - totalPagos);
  
  return {
    compras: totalCompras,
    comida: costoComida,
    pagos: totalPagos,
    total: deudaTotal
  };
}

// ================== MODALES ==================
window.showModal = function(id, noReset = false) {
  document.getElementById('modal-' + id).classList.add('active');
  if (!noReset) {
    if (id === 'producto') {
      document.getElementById('producto-sku').value = '';
      document.getElementById('producto-nombre').value = '';
      document.getElementById('producto-categoria').value = 'Bebida';
      document.getElementById('producto-stock').value = 0;
      document.getElementById('producto-precio-compra').value = 0;
      document.getElementById('producto-precio-venta').value = 0;
      document.getElementById('modal-titulo-producto').textContent = 'Nuevo Producto';
      // Enfocar el campo nombre después de un pequeño retraso
      setTimeout(() => document.getElementById('producto-nombre')?.focus(), 100);
    }
    if (id === 'personal') {
      document.getElementById('personal-codigo-original').value = '';
      document.getElementById('personal-codigo').value = generarCodigoPersonal();
      document.getElementById('personal-nombres').value = '';
      document.getElementById('personal-dni').value = '';
      document.getElementById('personal-area').value = '';
      document.getElementById('modal-titulo-personal').textContent = 'Nuevo Personal';
      setTimeout(() => document.getElementById('personal-nombres')?.focus(), 100);
    }
  } else {
    // Cuando se-edita, también enfocar
    setTimeout(() => document.getElementById('producto-nombre')?.focus(), 100);
  }
};

window.closeModal = function(id) {
  document.getElementById('modal-' + id).classList.remove('active');
};