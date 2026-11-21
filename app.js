// Datos de partida
const productosIniciales = [
    { nombre: "Teclado mecánico", precio: 79, stock: 5 },
    { nombre: "Ratón gaming", precio: 39, stock: 10 },
    { nombre: "Auriculares inalámbricos", precio: 99, stock: 3 },
    { nombre: "Monitor 4K", precio: 249, stock: 0 },
];

// Cargar stock e historial desde localStorage (o usar los iniciales)
let productos = JSON.parse(localStorage.getItem("pixelstore_productos")) || structuredClone(productosIniciales);
let historial = JSON.parse(localStorage.getItem("pixelstore_historial")) || [];

// Variable para guardar los datos del pedido actual por si toca reintentar el envío (Apartado 4)
let pedidoPendienteEnvio = null;

// Referencias al DOM
const formPedido = document.getElementById("form-pedido");
const selectProducto = document.getElementById("producto");
const inputCantidad = document.getElementById("cantidad");
const inputDireccion = document.getElementById("direccion");
const btnComprar = document.getElementById("btn-comprar");
const btnReintentar = document.getElementById("btn-reintentar");
const mensajeResultado = document.getElementById("mensaje-resultado");
const listaPedidos = document.getElementById("lista-pedidos");

const pasoStock = document.getElementById("paso-stock");
const pasoGastos = document.getElementById("paso-envio-gastos");
const pasoPago = document.getElementById("paso-pago");
const tituloPago = document.getElementById("titulo-pago");
const pasoEnvio = document.getElementById("paso-envio");


// FUNCIONES AUXILIARES Y DE INTERFAZ

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function guardarEnLocalStorage() {
    localStorage.setItem("pixelstore_productos", JSON.stringify(productos));
    localStorage.setItem("pixelstore_historial", JSON.stringify(historial));
}

function renderizarSelectProductos() {
    const valorSeleccionado = selectProducto.value;
    selectProducto.innerHTML = "";

    productos.forEach((prod, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = `${prod.nombre} - ${prod.precio} € (${prod.stock} en stock)`;
        selectProducto.appendChild(option);
    });

    if (valorSeleccionado !== "") {
        selectProducto.value = valorSeleccionado;
    }
}

function renderizarHistorial() {
    listaPedidos.innerHTML = "";

    if (historial.length === 0) {
        listaPedidos.innerHTML = `<li class="historial-vacio">Todavía no has realizado ningún pedido.</li>`;
        return;
    }

    historial.forEach((pedido) => {
        const li = document.createElement("li");
        li.className = "historial-item";
        li.innerHTML = `
            <span class="historial-fecha">${pedido.fecha}</span>
            <span class="historial-producto">${pedido.producto} × ${pedido.cantidad}</span>
            <span class="historial-direccion">${pedido.direccion}</span>
        `;
        listaPedidos.appendChild(li);
    });
}

function actualizarEstadoPaso(elemento, estado, textoEstado) {
    elemento.className = `paso ${estado}`;
    elemento.querySelector(".paso-estado").textContent = textoEstado;
}

function resetearPasos() {
    actualizarEstadoPaso(pasoStock, "pendiente", "Pendiente");
    actualizarEstadoPaso(pasoGastos, "pendiente", "Pendiente");
    actualizarEstadoPaso(pasoPago, "pendiente", "Pendiente");
    actualizarEstadoPaso(pasoEnvio, "pendiente", "Pendiente");
    tituloPago.textContent = "Procesar pago";
    mensajeResultado.className = "mensaje oculto";
    mensajeResultado.textContent = "";
    btnReintentar.classList.add("oculto");
}

function mostrarMensaje(texto, tipo) {
    mensajeResultado.textContent = texto;
    mensajeResultado.className = `mensaje ${tipo}`;
}

function obtenerFechaActual() {
    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, "0");
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const anio = ahora.getFullYear();
    const horas = String(ahora.getHours()).padStart(2, "0");
    const minutos = String(ahora.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
}

// PROMESAS DEL PROCESO DE COMPRA 

async function comprobarStock(producto, cantidad) {
    actualizarEstadoPaso(pasoStock, "en-curso", "En curso...");
    await esperar(1000);

    if (producto.stock >= cantidad && cantidad > 0) {
        actualizarEstadoPaso(pasoStock, "completado", "Completado");
        return true;
    } else {
        actualizarEstadoPaso(pasoStock, "error", "Error");
        throw new Error(`No hay stock suficiente de ${producto.nombre}`);
    }
}

async function calcularGastosEnvio(totalProductos, direccion) {
    actualizarEstadoPaso(pasoGastos, "en-curso", "En curso...");
    await esperar(1500);

    if (!direccion.trim()) {
        actualizarEstadoPaso(pasoGastos, "error", "Error");
        throw new Error("Falta la dirección de envío");
    }

    const gastos = totalProductos > 100 ? 0 : 5;
    actualizarEstadoPaso(pasoGastos, "completado", "Completado");
    return gastos;
}

async function procesarPago(totalFinal) {
    tituloPago.textContent = `Procesar pago (${totalFinal} €)`;
    actualizarEstadoPaso(pasoPago, "en-curso", "En curso...");
    await esperar(1500);

    actualizarEstadoPaso(pasoPago, "completado", "Completado");
    return `Pago de ${totalFinal} € realizado`;
}

async function enviarPedido(direccion) {
    actualizarEstadoPaso(pasoEnvio, "en-curso", "En curso...");
    await esperar(2000);

    // 20% de probabilidad de fallo
    if (Math.random() < 0.2) {
        actualizarEstadoPaso(pasoEnvio, "error", "Error");
        throw new Error("Error durante el envío, inténtelo de nuevo");
    }

    actualizarEstadoPaso(pasoEnvio, "completado", "Completado");
    return `Pedido enviado a ${direccion}`;
}

// FLUJO PRINCIPAL Y REINTENTO

function finalizarPedidoExitoso(indiceProducto, cantidad, direccion, mensajeEnvio) {
    // Actualizar stock
    productos[indiceProducto].stock -= cantidad;

    // Añadir al principio del historial
    historial.unshift({
        fecha: obtenerFechaActual(),
        producto: productos[indiceProducto].nombre,
        cantidad: cantidad,
        direccion: direccion,
    });

    guardarEnLocalStorage();
    renderizarSelectProductos();
    renderizarHistorial();

    pedidoPendienteEnvio = null;
    btnReintentar.classList.add("oculto");
    mostrarMensaje(mensajeEnvio, "exito");
}

formPedido.addEventListener("submit", async (e) => {
    e.preventDefault();

    const indiceProducto = Number(selectProducto.value);
    const producto = productos[indiceProducto];
    const cantidad = Number(inputCantidad.value);
    const direccion = inputDireccion.value.trim();
    const totalProductos = producto.precio * cantidad;

    resetearPasos();
    pedidoPendienteEnvio = null;
    btnComprar.disabled = true;
    btnComprar.textContent = "Procesando...";

    let pagoRealizado = false;

    try {
        // Paso 1: Comprobar stock y calcular gastos a la vez
        const [, gastosEnvio] = await Promise.all([
            comprobarStock(producto, cantidad),
            calcularGastosEnvio(totalProductos, direccion),
        ]);

        // Paso 2: Procesar pago
        const totalFinal = totalProductos + gastosEnvio;
        await procesarPago(totalFinal);
        pagoRealizado = true;

        // Guardamos los datos por si falla el envío
        pedidoPendienteEnvio = { indiceProducto, cantidad, direccion };

        // Paso 3: Enviar pedido
        const mensajeEnvio = await enviarPedido(direccion);

        // Si todo fue bien, actualizamos stock e historial
        finalizarPedidoExitoso(indiceProducto, cantidad, direccion, mensajeEnvio);

    } catch (error) {
        mostrarMensaje(error.message, "error");

        // Si el error ocurrió en el envío (después de pagar), mostramos botón de reintento
        if (pagoRealizado) {
            btnReintentar.classList.remove("oculto");
        }
    } finally {
        btnComprar.disabled = false;
        btnComprar.textContent = "Realizar compra";
    }
});

// Apartado 4: Reintentar solo el envío sin volver a comprobar stock ni cobrar
btnReintentar.addEventListener("click", async () => {
    if (!pedidoPendienteEnvio) return;

    btnComprar.disabled = true;
    btnReintentar.disabled = true;
    mensajeResultado.className = "mensaje oculto";

    try {
        const { indiceProducto, cantidad, direccion } = pedidoPendienteEnvio;
        const mensajeEnvio = await enviarPedido(direccion);
        finalizarPedidoExitoso(indiceProducto, cantidad, direccion, mensajeEnvio);
    } catch (error) {
        mostrarMensaje(error.message, "error");
    } finally {
        btnComprar.disabled = false;
        btnReintentar.disabled = false;
    }
});

// Inicialización al cargar la página
renderizarSelectProductos();
renderizarHistorial();