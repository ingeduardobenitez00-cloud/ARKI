function get_path_candidato(candidato) {
    /*
     * Devuelve el path de la imagen del candidato.
     */
    var path_imagenes = 'imagenes_candidaturas/default.png';
    if (candidato.imagen !== null) {
        path_imagenes = 'imagenes_candidaturas/' + constants.juego_de_datos + '/' + candidato.imagen;
    } else {
        if (candidato.sexo == "F") {
            path_imagenes = 'imagenes_candidaturas/default_mujer.png';
        }
    }
    return path_imagenes;
}

function get_path_lista(imagen_lista) {
    /*
     * Devuelve el path de la imagen de lista.
     */
    var imagen = 'imagenes_candidaturas/default_lista.png';
    if (imagen_lista !== null) {
        imagen = 'imagenes_candidaturas/' + constants.juego_de_datos + '/' + imagen_lista;
    }
    return imagen;
}

function get_path_partido(imagen_interna) {
    /*
     * Devuelve el path de la imagen del partido.
     */
    var imagen = 'imagenes_candidaturas/default_interna.png';
    if (imagen_interna !== null) {
        imagen = 'imagenes_candidaturas/' + constants.juego_de_datos + '/' + imagen_interna;
    }
    return imagen;
}

function precachear_imagen(imagen) {
    var img = document.createElement("img");
    img.src = path_imagen(imagen);
}

/**
 * Función que busca el path de una imagen dentro de la constante `imagenes_eleccion`:
 * un json cuya `'clave'` es el nombre del archivo
 * y su `'valor'` es el path a dicha imágen.
 *
 * @param {str} nombre - nombre con ruta relativa a la imagen a buscar
 * @param {str} extension - extensión del archivo, por defecto "png"
 * @returns {str|null} - retorna un string con la ruta al archivo buscado
 */
function get_path_imagen_eleccion(nombre, extension = "png") {
    const image_name = `${nombre}.${extension}`;
    if (typeof constants.imagenes_eleccion[image_name] === 'undefined'){
        console.warn(`Imagen no encontrada: ${nombre}`);
    }
    return constants.imagenes_eleccion[image_name];
}
