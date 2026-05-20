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
  
  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>${totalVentas}</h3>
        <p>Total Ventas</p>
      </div>
      <div class="stat-card">
        <h3 style="color: var(--accent)">S/ ${totalDeuda.toFixed(2)}</h3>
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
              ${deudores.slice(0, 5).map(c => `
                <tr>
                  <td>${c.apellidosNombres}</td>
                  <td>${c.areaTrabajo}</td>
                  <td class="deuda-alta">S/ ${calcularDeudaPersonal(c.codigo).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="padding:20px; text-align:center; color:#666">No hay deudas pendientes</p>'}
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
    <div id="modal-producto" class="modal">
      <div class="modal-content">
        <h3 id="modal-titulo-producto">Nuevo Producto</h3>
        <form id="form-producto" onsubmit="guardarProducto(event)">
          <input type="hidden" name="sku" id="producto-sku">
          <div class="form-group"><label>Nombre</label><input type="text" name="nombre" id="producto-nombre" required></div>
          <div class="form-group"><label>Categoría</label>
            <select name="categoria" id="producto-categoria">
              <option value="Bebida">Bebida</option>
              <option value="Snack">Snack/Galleta</option>
              <option value="Panadería">Panadería/Dulce</option>
              <option value="Chocolate">Chocolate/Caramelo</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div class="form-group"><label>Stock</label><input type="number" name="stock" id="producto-stock" value="0" required></div>
          <div class="form-group"><label>Precio de Compra</label><input type="number" name="precioCompra" id="producto-precio-compra" step="0.10" value="0"></div>
          <div class="form-group"><label>Precio de Venta</label><input type="number" name="precioVenta" id="producto-precio-venta" step="0.10" value="0"></div>
          <div style="display:flex; gap:10px; margin-top:20px">
            <button type="submit" class="btn btn-primary">Guardar</button>
            <button type="button" class="btn" onclick="closeModal('producto')">Cancelar</button>
          </div>
        </form>
      </div>
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
        <p><strong>Precio de Venta:</strong> S/ <span id="ingreso-precio-venta"></span></p>
      </div>
      <div id="form-ingreso" style="display:none; margin-top:20px; padding:20px; background:#fff; border:1px solid #ddd; border-radius:8px">
        <h4 style="margin-bottom:15px">Registrar Ingreso</h4>
        <div class="form-group">
          <label style="display:block; margin-bottom:5px; font-weight:600">Cantidad a Ingresar</label>
          <input type="number" id="ingreso-cantidad" min="1" value="1" style="width:100%; padding:12px; border:1px solid #ccc; border-radius:5px; font-size:1rem">
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
  document.getElementById('ingreso-precio-venta').textContent = (prod.precioVenta || 0).toFixed(2);
  document.getElementById('form-ingreso').style.display = 'block';
};

window.confirmarIngreso = async function() {
  const sku = document.getElementById('ingreso-producto').value;
  const cantidad = parseInt(document.getElementById('ingreso-cantidad').value);
  if (!sku || cantidad < 1) { alert('Seleccione un producto y cantidad válida'); return; }
  
  const prod = productos.find(p => p.sku === sku);
  if (!prod) { alert('Producto no encontrado'); return; }
  
  const stockAnterior = prod.stock;
  prod.stock += cantidad;
  
  await ipcRenderer.invoke('save-productos', productos);
  alert(`Ingreso registrado: +${cantidad} unidades de ${prod.nombre}\nStock: ${stockAnterior} → ${prod.stock}`);
  productos = await ipcRenderer.invoke('get-productos');
  renderView('ingresos');
};

// ================== PERSONAL ==================
async function renderPersonal(content) {
  const personalData = await ipcRenderer.invoke('get-personal');
  personal = (personalData && Array.isArray(personalData)) ? personalData : [];
  
  let html = '<div style="padding:20px; font-family:Arial">';
  html += '<h2>👥 Personal</h2>';
  html += '<div style="margin:15px 0">';
  html += '<button onclick="showModal(\'personal\')" style="padding:8px 16px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer">➕ Nuevo Personal</button>';
  html += '<button onclick="importarPersonalExcel()" style="padding:8px 16px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; margin-left:10px">📥 Importar desde Excel</button>';
  html += '<button onclick="exportarPersonalExcel()" style="padding:8px 16px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer; margin-left:10px">📤 Exportar a Excel</button>';
  html += '</div>';
  
  if (personal.length === 0) {
    html += '<p style="color:orange">⚠️ No hay personal cargado. Use el botón "Importar desde Excel" para cargar los datos.</p>';
  } else {
    html += '<p>Total: ' + personal.length + ' trabajadores</p>';
    html += '<table style="width:100%; border-collapse:collapse; border:1px solid #ccc">';
    html += '<thead><tr style="background:#f0f0f0">';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:left">Código</th>';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:left">Nombres y Apellidos</th>';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:left">DNI</th>';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:left">Área</th>';
    html += '<th style="padding:10px; border:1px solid #ccc; text-align:center">Acciones</th>';
    html += '</tr></thead><tbody>';
    
    for (let i = 0; i < personal.length; i++) {
      let p = personal[i];
      let nombre = p.apellidosNombres || p.nombre || '-';
      let area = p.areaTrabajo || p.area || '-';
      html += '<tr>';
      html += '<td style="padding:8px; border:1px solid #ccc">' + (p.codigo || '-') + '</td>';
      html += '<td style="padding:8px; border:1px solid #ccc">' + nombre + '</td>';
      html += '<td style="padding:8px; border:1px solid #ccc">' + (p.dni || '-') + '</td>';
      html += '<td style="padding:8px; border:1px solid #ccc">' + area + '</td>';
      html += '<td style="padding:8px; border:1px solid #ccc; text-align:center">';
      html += '<button onclick="editarPersonal(\'' + p.codigo + '\')" style="padding:4px 8px; cursor:pointer">✏️</button>';
      html += '<button onclick="eliminarPersonal(\'' + p.codigo + '\')" style="padding:4px 8px; cursor:pointer; margin-left:5px">🗑️</button>';
      html += '</td></tr>';
    }
    html += '</tbody></table>';
  }
  html += '</div>';
  content.innerHTML = html;
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
function renderComida(content) {
  content.innerHTML = `
    <div class="card">
      <h3>🍽️ Registro de Comida</h3>
      <p style="color:#666; margin-bottom:20px">Registre los días de consumo de comida del personal</p>
      
      <div class="form-group">
        <label>Seleccionar Trabajador</label>
        <select id="comida-trabajador" onchange="cargarConsumosTrabajador()">
          <option value="">-- Seleccione un trabajador --</option>
          ${personal.map(p => { const info = getPersonalInfo(p); return `<option value="${p.codigo}">${info.nombre} - ${info.area}</option>`; }).join('')}
        </select>
      </div>
      
      <div id="consumos-trabajador" style="display:none; margin-top:20px">
        <h4>Días de Comida Registrados</h4>
        <p style="color:#666">Ingrese las fechas de consumo (una por línea):</p>
        <textarea id="fechas-consumo" rows="10" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px" placeholder="2026-05-11&#10;2026-05-12&#10;2026-05-13"></textarea>
        <button class="btn btn-primary" onclick="guardarConsumosComida()" style="margin-top:10px">💾 Guardar</button>
      </div>
    </div>
    
    <div class="card">
      <h3>Resumen de Consumos</h3>
      <table>
        <thead><tr><th>Trabajador</th><th>Días de Consumo</th><th>Total</th></tr></thead>
        <tbody>
          ${personal.map(p => {
            const consumos = consumosComida.filter(c => c.codigo === p.codigo);
            const info = getPersonalInfo(p);
            return `<tr><td>${info.nombre}</td><td>${consumos.length}</td><td>S/ ${(consumos.length * 30).toFixed(2)}</td></tr>`;
          }).join('') || '<tr><td colspan="3">No hay consumos registrados</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

window.cargarConsumosTrabajador = function() {
  const trabajadorCodigo = document.getElementById('comida-trabajador').value;
  if (!trabajadorCodigo) {
    document.getElementById('consumos-trabajador').style.display = 'none';
    return;
  }
  document.getElementById('consumos-trabajador').style.display = 'block';
  
  // Cargar consumos existentes
  const consumos = consumosComida.filter(c => c.codigo === trabajadorCodigo);
  const fechas = consumos.map(c => c.fecha).join('\n');
  document.getElementById('fechas-consumo').value = fechas;
};

window.guardarConsumosComida = async function() {
  const trabajadorCodigo = document.getElementById('comida-trabajador').value;
  if (!trabajadorCodigo) { alert('Seleccione un trabajador'); return; }
  
  const textoFechas = document.getElementById('fechas-consumo').value;
  const lineas = textoFechas.split('\n').map(l => l.trim()).filter(l => l);
  
  const trab = personal.find(p => p.codigo === trabajadorCodigo);
  if (!trab) { alert('Trabajador no encontrado'); return; }
  
  // Eliminar consumos anteriores de este trabajador
  consumosComida = consumosComida.filter(c => c.codigo !== trabajadorCodigo);
  
  // Agregar nuevos consumos
  for (const fecha of lineas) {
    consumosComida.push({
      id: Date.now() + Math.random(),
      fecha: fecha,
      codigo: trabajadorCodigo,
      nombre: trab.apellidosNombres,
      monto: 30
    });
  }
  
  // Actualizar ventas de comida
  ventas = ventas.filter(v => !(v.clienteCodigo === trabajadorCodigo && v.tipo === 'comida'));
  if (lineas.length > 0) {
    const venta = {
      id: Date.now(),
      fecha: new Date().toLocaleDateString('es'),
      clienteCodigo: trabajadorCodigo,
      clienteNombre: trab.apellidosNombres,
      items: [{ sku: 'COMIDA', cantidad: lineas.length, precio: 30 }],
      total: lineas.length * 30,
      tipo: 'comida',
      descripcion: `Comida ${lineas.length} días`
    };
    ventas.push(venta);
    await ipcRenderer.invoke('save-ventas', ventas);
  }
  
  await ipcRenderer.invoke('save-consumos-comida', consumosComida);
  alert(`Guardados ${lineas.length} días de consumo`);
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
  if (!producto || producto.stock === 0) return;
  const index = productosVentaSeleccionados.findIndex(p => p.sku === sku);
  if (index >= 0) { productosVentaSeleccionados.splice(index, 1); }
  else { productosVentaSeleccionados.push({ sku: sku, cantidad: 1, precioVenta: producto.precioVenta || 0 }); }
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
  let html = '<table style="width:100%"><thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>';
  let total = 0;
  productosVentaSeleccionados.forEach(p => {
    const prod = productos.find(pr => pr.sku === p.sku);
    const precioVenta = prod ? (prod.precioVenta || 0) : 0;
    const subtotal = p.cantidad * precioVenta;
    total += subtotal;
    html += `<tr><td>${prod ? prod.nombre : p.sku}</td><td>${p.cantidad}</td><td>S/ ${precioVenta.toFixed(2)}</td><td>S/ ${subtotal.toFixed(2)}</td></tr>`;
  });
  html += `<tr><td colspan="3"><strong>TOTAL</strong></td><td><strong>S/ ${total.toFixed(2)}</strong></td></tr></tbody></table>`;
  container.innerHTML = html;
  btnConfirmar.disabled = false;
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
  content.innerHTML = `
    <div class="card">
      <h3>📋 Control de Deudas</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>${deudores.length}</h3>
          <p>Personal con Deuda</p>
        </div>
        <div class="stat-card">
          <h3 style="color: var(--accent)">S/ ${calcularDeudaTotal().toFixed(2)}</h3>
          <p>Deuda Total</p>
        </div>
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Área</th><th>Deuda</th><th>Acción</th></tr></thead>
        <tbody>
          ${deudores.map(p => { const info = getPersonalInfo(p); return `
            <tr>
              <td>${info.nombre}</td>
              <td>${info.area}</td>
              <td class="deuda-alta">S/ ${calcularDeudaPersonal(p.codigo).toFixed(2)}</td>
              <td><button class="btn btn-success" onclick="registrarPago('${p.codigo}')">💵 Pagar</button></td>
            </tr>
          `; }).join('') || '<tr><td colspan="4">No hay deudas</td></tr>'}
        </tbody>
      </table>
    </div>
    <div id="modal-pago" class="modal">
      <div class="modal-content">
        <h3>Registrar Pago</h3>
        <form id="form-pago" onsubmit="guardarPago(event)">
          <input type="hidden" name="codigo" id="pago-personal-codigo">
          <div class="form-group"><label>Monto a Pagar</label><input type="number" name="monto" step="0.10" required></div>
          <button type="submit" class="btn btn-success">Registrar</button>
          <button type="button" class="btn" onclick="closeModal('pago')">Cancelar</button>
        </form>
      </div>
    </div>
  `;
}

window.registrarPago = function(codigo) {
  const trab = personal.find(p => p.codigo === codigo);
  document.getElementById('pago-personal-codigo').value = codigo;
  document.getElementById('form-pago').childNodes[0].textContent = `Trabajador: ${trab.apellidosNombres} - Deuda: S/ ${calcularDeudaPersonal(codigo).toFixed(2)}`;
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
  content.innerHTML = `
    <div class="card">
      <h3>📈 Reportes</h3>
      <div class="stats-grid">
        <div class="stat-card"><h3>${ventas.length}</h3><p>Total Ventas</p></div>
        <div class="stat-card"><h3>S/ ${totalIngresos.toFixed(2)}</h3><p>Ingresos Totales</p></div>
        <div class="stat-card"><h3>S/ ${calcularDeudaTotal().toFixed(2)}</h3><p>Deuda Pendiente</p></div>
      </div>
    </div>
  `;
}

// ================== FUNCIONES AUXILIARES ==================
function calcularDeudaPersonal(codigo) {
  const compras = ventas.filter(v => v.clienteCodigo === codigo);
  const pagosPersonal = pagos.filter(p => p.clienteCodigo === codigo);
  const totalCompras = compras.reduce((sum, v) => sum + v.total, 0);
  const totalPagos = pagosPersonal.reduce((sum, p) => sum + p.monto, 0);
  return Math.max(0, totalCompras - totalPagos);
}

function calcularDeudaTotal() {
  return personal.reduce((sum, p) => sum + calcularDeudaPersonal(p.codigo), 0);
}

function getDeudores() {
  return personal.filter(p => calcularDeudaPersonal(p.codigo) > 0).sort((a, b) => calcularDeudaPersonal(b.codigo) - calcularDeudaPersonal(a.codigo));
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
    }
    if (id === 'personal') {
      document.getElementById('personal-codigo-original').value = '';
      document.getElementById('personal-codigo').value = generarCodigoPersonal();
      document.getElementById('personal-nombres').value = '';
      document.getElementById('personal-dni').value = '';
      document.getElementById('personal-area').value = '';
      document.getElementById('modal-titulo-personal').textContent = 'Nuevo Personal';
    }
  }
};

window.closeModal = function(id) {
  document.getElementById('modal-' + id).classList.remove('active');
};