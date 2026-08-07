
// Inicializar datos por defecto
currentBatteryData = false;
show_status_battery = true;

/**
 * Función llamada cuando hay nueva información del estado de la batería.
 *
 * @param {Array} data - Un array de objetos de batería.
 */
function inicio_status_battery({ batteries, modulo }) {
    currentBatteryData = batteries;
    if (!currentBatteryData || !show_status_battery) {
        disable_show_status_battery();
        return
    } else {
        enable_show_status_battery();
    }
    popular_header_baterias()
}

function disable_show_status_battery(data=null) {
    show_status_battery = false;
    if (currentBatteryData) {
        if (document.querySelector('#baterias')){
            document.querySelector('#baterias').style.display = 'none';
        }
    }
}

function enable_show_status_battery(data=null) {
    show_status_battery = true;
    if (currentBatteryData) {
        if (document.querySelector('#baterias')) {
            document.querySelector('#baterias').style.display = '';
        }
    }
}

/**
 * Renderiza el encabezado con los datos de la batería.
 */
function popular_header_baterias() {
    return new Promise((resolve, reject) => {
        const imageNames = [
            "bateria",
            "sin_bateria",
            "rayo"
        ];
        const path_imagenes = {};

        imageNames.map(imageName => path_imagenes[imageName] = get_path_imagen_eleccion(imageName, 'svg'));
        fetch_template("baterias", "partials").then((template_header) => {
            const html_header = template_header({
                path_imagenes: path_imagenes,
                data_bateria: currentBatteryData
            });
            document.querySelector('#baterias').innerHTML = html_header;
            resolve()
        }).catch((error) => {
            console.error("Error populando el encabezado: ", error);
            reject(error);
        });
    });
}
