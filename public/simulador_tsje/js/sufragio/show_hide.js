/**
 * 
 * @namespace js.sufragio.show_hide
 */

/**
* Muestra la pantalla de seleccion de idioma.
*/
function show_pantalla_idiomas(callback){
    document.getElementById('pantalla_idiomas').style.display = 'block';
    callback();
}

/**
* Oculta la pantalla de seleccion de idioma.
*/
function hide_pantalla_idiomas(callback){
    document.getElementById('pantalla_idiomas').style.display = 'none';
    callback();
}

/**
* Muestra la pantalla de confirmacion.
*/
function show_confirmacion(){
    patio.pantalla_confirmacion.only();
    document.body.classList.add('en-confirmacion');
    window.setTimeout(function(){
        prepara_impresion();
    }, 50);
}

function _inicializar_etiqueta_mesa(){
    var elem = document.getElementById('etiqueta_mesa');
    if (!elem) return;
    var nro = (constants && constants.nro_mesa) ? constants.nro_mesa : '';
    elem.style.display = 'none';
}

function _mostrar_etiqueta_mesa(){
    document.body.classList.remove('en-confirmacion');
}

/**
 * Muestra menú de salida.
 */
function mostrar_menu_salida(){
    var elem = document.querySelector('body');
    if(elem.getAttribute('data-state') == 'alto-contraste') {
        elem.setAttribute('data-state', 'normal');
    }
    setTimeout(
        function(){
            patio.pantalla_menu.only();
            unico_modo = true;
            if(unico_modo){
                document.querySelector('#btn_regresar').style.display = 'block';
            }
            en_menu_salida = true
            document.querySelector('#accesibilidad #btn_regresar').removeEventListener("click", get_next_modo);
            document.querySelector('#accesibilidad #btn_regresar').addEventListener("click", insercion_boleta);
        }, 200);
}

/**
 * Cambia la pantalla de normal a alto contraste o viceversa.
 */
function toggle_alto_contraste(){
    var elem = document.querySelector("body");
    if(elem.getAttribute('data-state') == 'alto-contraste') {
        elem.setAttribute('data-state', 'normal');
    } else {
        elem.setAttribute('data-state', 'alto-contraste');
    }
}

/**
 * Prepara el contenedor para proceder con el voto por categorias.
 *
 * @param {*} cod_categoria - codigo de la categoria seleccionada. 
 */
function actualizar_ui_voto_categorias(cod_categoria){
    var categoria = localController.businessData._get_one_categoria(cod_categoria);
    cambiar_categoria(categoria || cod_categoria);
    update_titulo_categoria();
}

/*
 * Actualiza la solapa que contiene el nombre de la categoria que se estan votando.
 */
function update_titulo_categoria(){
    var categoria_actual = get_categoria_actual()
    if(categoria_actual !== undefined){
      contenido_solapa(categoria_actual.nombre);
    }
}

/**
 * Cambia el contenido de la solapa del titulo.
 * Aplica la clase 'solapa-primera-categoria' al encabezado si la categoría
 * actual es la primera del flujo
 */
function contenido_solapa(html){
    patio.categoria_votada.html(html);
    patio.categoria_votada.show();
    _actualizar_clase_solapa();
}

/**
 * Alterna el color del tab entre cargos.
 * Las preferencias/tachas del mismo cargo mantienen el color porque
 * comparten el mismo cod_categoria.
 */
function _actualizar_clase_solapa(){
    var encabezado = document.querySelector("#encabezado");
    if (!encabezado) return;
    try {
        var cat_actual = get_categoria_actual();
        var cod_actual = (cat_actual && typeof cat_actual === 'object')
                         ? cat_actual.codigo
                         : cat_actual;
        if (!cod_actual) {
            encabezado.classList.remove("solapa-primera-categoria");
            return;
        }
        // Obtener todas las categorias ordenadas por posicion
        var categorias = localController.businessData.get_categorias_many({ sorted: "posicion" });
        var indice = -1;
        for (var i = 0; i < categorias.length; i++) {
            if (categorias[i].codigo === cod_actual) {
                indice = i;
                break;
            }
        }
        // par → negro, impar → blanco
        if (indice >= 0 && indice % 2 === 0) {
            encabezado.classList.add("solapa-primera-categoria");
        } else {
            encabezado.classList.remove("solapa-primera-categoria");
        }
    } catch(e) {
        encabezado.classList.remove("solapa-primera-categoria");
    }
}

/**
 * Muestra la solapa.
 */
function mostrar_template_solapa(template, datos){
    fetch_template(template).then((template_solapa) => {
        const html = template_solapa(datos);
        contenido_solapa(html);
    });
}

/**
 * Llama a la función :func:`<js.sufragio.show_hide.mostrar_template_solapa>`.
 */
function solapa(candidatura, categoria, partido) {
    if (constants.solapa_inteligente && typeof candidatura !== "undefined") {
        mostrar_template_solapa(
            "solapa",
            {
                candidatura: candidatura,
                categoria: categoria,
                partido: partido,
            },
            typeof categoria == "undefined"
        );
    }
}
