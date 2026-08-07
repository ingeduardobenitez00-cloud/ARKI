/**
 * @namespace js.sufragio.ipc
 */

var constants = {};


/**
* Envia la señal "document_ready" al backend.
*/
function load_ready_msg(){
    send('document_ready');
}

/* Manda la señal de inicializar la interfaz de votacion. */
function inicializar_interfaz(){
    send('inicializar_interfaz');
}

/* Manda la señal de cargar el cache. */
function cargar_cache(){
    send('cargar_cache');
}

/**
 * Selecciona un idioma dado.
 *
 * @param {*} modo - El idioma seleccionado.
 */
function seleccionar_idioma(modo) {
    send("seleccionar_idioma", modo);
}

/**
 * Recibe la pantalla a la que se debe cambiar y los parametros con los que esa pantalla debe ser llamada.
 *
 * @param {*} pantalla - Nueva pantalla.
 */
function change_screen(pantalla) {
    func = window[pantalla[0]];
    func(pantalla[1]);
}

/**
 * Envia la señal para preparar la impresion.
 */
function prepara_impresion() {
    send("prepara_impresion");
}

/**
 * Envia la señal avisandole al backend que queremos previsualizar el voto.
 */
function previsualizar_voto() {
    send("previsualizar_voto");
}

/**
 * Envia la señal avisandole al backend que queremos confirmar la seleccion.
 */
function confirmar_seleccion() {
    send("confirmar_seleccion");
}

/**
 * Avisa al backend que fue presionado el asterisco de asistida.
 *
 * @param {*} numero - El número seleccionado.
 */
function asterisco(numero) {
    send("asterisco", numero);
}

/**
 * Avisa al backend que apretamos el numeral de asistida.
 *
 * @param {*} numero - El número seleccionado.
 */
function numeral(numero) {
    send("numeral", numero);
}

/**
 * Avisa al backend que tiene que lanzar el sonido de tecla apretada.
 */
function sonido_tecla() {
    send("sonido_tecla");
}

/**
 * Avisa al backend que tiene que lanzar el sonido de alerta.
 */
function sonido_warning() {
    send("sonido_warning");
}

/**
 * Funcion llamada desde el back que trae los datos de la eleccion para ser procesados
 *
 * @param {*} data - Un diccionario con los datos que vienen del backend. Las key que manda son "categorias", "candidaturas", "agrupaciones", "boletas".
 */
function cargar_datos(data) {
    /*
     *
     * Argumentos:
     * data -- un diccionario con los datos que vienen del backend. Las keys
     * que manda son "categorias", "candidaturas", "agrupaciones", "boletas".
     */

    localController.cargar_datos(data);
    _inicializar_etiqueta_mesa();
}

/**
 * Funcion llamada desde el back carga la pantalla inicial cuando un elector mete una boleta.
 */
function cargar_pantalla_inicial() {
    _mostrar_etiqueta_mesa();
    _inicializar_etiqueta_mesa();
    localController.cargar_pantalla_inicial();
}

/**
 * Funcion llamada desde el back para selecciona el modo de votacion y actua en consecuencia.
 *
 * @param {string} modo - Un string con el modo de votacion.
 */
function seleccionar_modo(modo) {
    localController.seleccionar_modo(modo);
}

/**
 * Funcion llamada desde el back que selecciona una lista y decide para donde seguir.
 *
 * @param {*} cod_lista - Código de lista seleccionado, o el id de un candidato en caso de agrupar por cargo.
 */
function seleccionar_lista(cod_lista) {
    localController.seleccion_lista(cod_lista);
}

function seleccionar_candidatos(categoria, codigos) {
    localController.controller_seleccionar_candidatos(categoria, codigos);
}