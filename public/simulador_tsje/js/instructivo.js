document.addEventListener("DOMContentLoaded", inicializacion);

//SETTINGS
var saltar_unica = true;

function bindUbicacionClick(items, handler) {
    Array.from(items).forEach(function(item) {
        item.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
        item.addEventListener('click', function(e) {
            handler.call(this, e);
            this.blur();
        });
    });
}

function inicializacion() {
    const ubicacion = "59.0.0";
    window.localStorage.setItem('ub_eleccion',     "ASOCIACION NACIONAL REPUBLICANA");
    window.localStorage.setItem('ub_departamento', "CAPITAL");
    window.localStorage.setItem('ub_distrito',     "ASUNCION");
    window.localStorage.setItem('ub_localidad',    "");
    window.localStorage.setItem("ubicacion", ubicacion);
    window.location.replace("sufragio.html?ubicacion=" + ubicacion);
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
        console.log("Mensaje recibido en el cliente", event.data);
        if (event.data.command === "IMAGENES_CACHEADAS") {
            document.location = "/";
        } else if (event.data.command === "ERROR_CACHEANDO_IMAGENES") {
            habilitar_boton_comenzar(true);
            habilitar_boton_cargando(false);
        }
    });
}

function habilitar_boton_comenzar(habilitar) {
    document.querySelector("#btn-continuar").style.display = habilitar
        ? "inline"
        : "none";
}

function habilitar_boton_cargando(habilitar) {
    document.querySelector("#btn-continuar-loading").style.display = habilitar
        ? "inline"
        : "none";
}

function cambiar_url(paso) {
    //setear url con el valor 'paso' que se le pasa a la funcion
    let url = window.location.href.split("#")[0];
    window.location.href = url + "#" + paso;
}

function empezar_demo() {
    cambiar_url("paso-1");
    document
        .getElementById("empezar")
        .removeEventListener("click", empezar_demo);
    const TagBody = document.getElementsByTagName("body");
    Array.from(TagBody).forEach(function (item) {
        item.setAttribute("id", "");
    });
}

function mostrar_siguiente_paso(event) {
    event.stopPropagation();
    const next = event.target.parentElement.nextElementSibling;
    if (next && next.getAttribute("id") != "undefined") {
        if (next.getAttribute("id") === "ubicaciones") {
            const ubicacion = "59.0.0";
            window.localStorage.setItem('ub_eleccion',     "ASOCIACION NACIONAL REPUBLICANA");
            window.localStorage.setItem('ub_departamento', "CAPITAL");
            window.localStorage.setItem('ub_distrito',     "ASUNCION");
            window.localStorage.setItem('ub_localidad',    "");
            window.localStorage.setItem("ubicacion", ubicacion);
            window.location = "sufragio.html?ubicacion=" + ubicacion;
            return;
        }
        cambiar_url(next.getAttribute("id"));
    }
}


function mostrar_nivel(ubicaciones_a_ocultar, id_nivel_a_mostrar){
    
    let a_ocultar = document.getElementsByClassName(`elegir_${ubicaciones_a_ocultar}`);
    Array.from(a_ocultar).forEach(function (item) {
        item.style.display = 'none';
    });

    const elementos_a_mostrar = document.querySelector(`[data-${ubicaciones_a_ocultar}="${id_nivel_a_mostrar}"]`);
    if (!elementos_a_mostrar) {
        return;
    }
    if (elementos_a_mostrar.children.length === 1 && saltar_unica && ubicaciones_a_ocultar=='distrito')        
        elementos_a_mostrar.children[0].click(); 
    else elementos_a_mostrar.style.display = 'flex';
}

function mostrar_departamentos(event) {
    event.stopPropagation();
    document.getElementById('nivel-a-elegir').innerText = "el Departamento";
    const id_nivel = event.currentTarget.dataset.id;
    mostrar_nivel('eleccion', id_nivel);
}

function mostrar_distritos(event) {
    event.stopPropagation();
    document.getElementById('nivel-a-elegir').innerText = "el Distrito";
    const id_nivel = event.currentTarget.dataset.id;
    mostrar_nivel('departamento', id_nivel);
}

function mostrar_mesas(event) {
    event.stopPropagation();
    document.getElementById('nivel-a-elegir').innerText = "la Zona";
    const id_nivel = event.currentTarget.dataset.id;
    mostrar_nivel('distrito', id_nivel);
}


function volver_demo() {
    var ubicacion = window.localStorage.getItem("ubicacion");
    if (ubicacion != "null") {
        window.location = "sufragio.html?ubicacion=" + ubicacion;
    } else {
        cambiar_url("paso-3");
    }
}

function mostrar_demo_ubicacion(event) {
    event.stopPropagation();
    resetear_divs();
    const ubicacion = event.currentTarget.dataset.id;
    // titulo-ubicacion tiene el formato completo: "ELECCION / DEPARTAMENTO / DISTRITO / ZONA"
    // generado por el backend en el atributo del boton mesa.
    const titulo_ubicacion = event.currentTarget.getAttribute("titulo-ubicacion") || '';
    const partes = titulo_ubicacion.split(' / ');
    window.localStorage.setItem('ub_eleccion',     partes[0] || '');
    window.localStorage.setItem('ub_departamento', partes[1] || '');
    window.localStorage.setItem('ub_distrito',     partes[2] || '');
    window.localStorage.setItem('ub_localidad',    partes[3] || '');
    window.localStorage.setItem("ubicacion", ubicacion);
    window.location = "sufragio.html?ubicacion=" + ubicacion;
}

function mostrar_final() {
    const TagBody = document.getElementsByTagName("body");
    Array.from(TagBody).forEach(function (item) {
        item.setAttribute("id", "final");
    });
    cambiar_url("agradecimiento");
    // const IdAgrad = document.getElementById("agradecimiento");
    // IdAgrad.addEventListener("load", function(event){});
}

function inicio_demo() {
    cambiar_url("");
    const TagBody = document.getElementsByTagName("body");
    Array.from(TagBody).forEach(function (item) {
        item.setAttribute("id", "final");
    });
    const bienvenido = document.getElementById("bienvenido");
    bienvenido.style.display = "";
    const empezar = document.getElementById("empezar");
    empezar.style.display = "";
    document.getElementById("empezar").addEventListener("click", empezar_demo);
}

function resetear_divs() {
    const contenedorAyuda = document.querySelectorAll(
        "#contenedor-ayuda > div"
    );
    Array.from(contenedorAyuda).forEach(function (item) {
        item.style.display = "none";
    });
    const franja = document.querySelectorAll(".franja");
    Array.from(franja).forEach(function (item) {
        item.style.display = "none";
    });
}
