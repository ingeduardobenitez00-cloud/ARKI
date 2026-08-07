/**
 * @namespace js.sufragio.localController.businessData
 */

/* 
    El archivo businessData.js contiene funciones con logica de negocio
    que facilitan la obtención de datos locales relacionados con la aplicación.
*/

class BusinessData {
    constructor(dataService) {
        this.dataService = dataService;
    }

    /**
     *
     * @returns {any} - Objeto completo de localData.
     *
     */
    get_local_data() {
        return this.dataService._get_local_data();
    }

    /**
     * Settea local_data
     * @param {*} filter - settea localData
     *
     */
    set_local_data(localData) {
        this.dataService._set_local_data(localData);
    }

    /**
     * Funcion que modifica el valor de una key de local_data
     *
     * @param {*} key - key de local_data.
     * @param {*} value - valor de la key a modificar.
     */
    cambio_valor_local_data(key, value) {
        let local_data = this.get_local_data();
        if (key in local_data) {
            local_data[key] = value;
            this.dataService._set_local_data(local_data);
        }
    }

    /**
     *
     * @param {*} filter - filtro para boletas.
     * @returns {any} - Objeto de boletas.
     */
    get_boletas_first(filter) {
        return this.dataService._get_boletas_first(filter);
    }

    /**
     *
     * @param {*} filter - filtro para boletas.
     * @returns {any} - Objeto de boletas.
     */
    get_boletas_one(filter) {
        return this.dataService._get_boletas_one(filter);
    }

    /**
     *
     * @param {*} filter - filtro para boletas.
     * @returns {any} - Objeto de boletas.
     */
    get_boletas_many(filter) {
        return this.dataService._get_boletas_many(filter);
    }

    /**
     *
     * @returns {any} - Objeto de boletas.
     */
    get_all_boletas() {
        return this.dataService._get_all_boletas();
    }

    /**
     *
     * @param {*} filter - filtro para candidaturas.
     * @returns {any} - Objeto de candidaturas.
     */
    get_candidaturas_first(filter) {
        return this.dataService._get_candidaturas_first(filter);
    }

    /**
     *
     * @param {*} filter - filtro para candidaturas.
     * @returns {any} - Objeto de candidaturas.
     */
    get_candidaturas_one(filter) {
        return this.dataService._get_candidaturas_one(filter);
    }

    /**
     *
     * @param {*} filter - filtro para candidaturas.
     * @returns {any} - Objeto de candidaturas.
     */
    get_candidaturas_many(filter) {
        return this.dataService._get_candidaturas_many(filter);
    }

    /**
     *
     * @returns {any} - Objeto de candidaturas.
     */
    get_all_candidaturas() {
        return this.dataService._get_all_candidaturas();
    }

    /**
     *
     * @param {*} filter - filtro para la agrupacion.
     * @returns {any} - Objeto de agrupacion.
     */
    get_agrupaciones_first(filter) {
        return this.dataService._get_agrupaciones_first(filter);
    }

    /**
     *
     * @param {*} filter - filtro para la agrupacion.
     * @returns {any} - Objeto de agrupacion.
     */
    get_agrupaciones_one(filter) {
        return this.dataService._get_agrupaciones_one(filter);
    }

    /**
     *
     * @param {*} filter - filtro para la agrupacion.
     * @returns {any} - Objeto de agrupacion.
     */
    get_agrupaciones_many(filter) {
        return this.dataService._get_agrupaciones_many(filter);
    }

    /**
     *
     * @returns {any} - Objeto de agrupacion.
     */
    get_all_agrupaciones() {
        return this.dataService._get_all_agrupaciones();
    }

    /**
     *
     * @param {*} filter - filtro para la categorias.
     * @returns {any} - Objeto de categorias.
     */
    get_categorias_first(filter) {
        return this.dataService._get_categorias_first(filter);
    }

    /**
     *
     * @param {*} filter - filtro para la categorias.
     * @returns {any} - Objeto de categorias.
     */
    get_categorias_one(filter) {
        return this.dataService._get_categorias_one(filter);
    }

    /**
     *
     * @param {*} filter - filtro para la categorias.
     * @returns {any} - Objeto de categorias.
     */
    get_categorias_many(filter) {
        return this.dataService._get_categorias_many(filter);
    }

    /**
     *
     * @returns {any} - Objeto de categorias.
     */
    get_all_categorias() {
        return this.dataService._get_all_categorias();
    }

    /**
     *  Esta función toma un código de cargo como entrada y devuelve
     *  un objeto de categorías modificado que representa una candidatura aleatoria para ese cargo.
     *
     * @param {*} codigo_cargo - Codigo de cargo recibido.
     * @returns {any} - Objeto de categorias modificado.
     */
    random_candidatura(codigo_cargo) {
        let local_data = this.get_local_data();
        return random_item(
            local_data.candidaturas._data.filter(
                (i) =>
                    i.cod_categoria === codigo_cargo && i.clase !== "Especial"
            )
        );
        function random_item(array) {
            return array[Math.floor(Math.random() * array.length)];
        }
    }

    /**
     * Devuelve la categoria que le pedimos o la primera si no le pedimos ninguna.
     *
     * @param {*} cod_categoria - Código de la categoria que queremos traer.
     */
    _get_categoria(cod_categoria) {
        const categoria = this.get_categorias_one({ codigo: cod_categoria });
        return categoria;
    }

    /**
     * Devuelve la categoria que le pedimos o la primera si no le pedimos ninguna.
     *
     * @param {*} cod_categoria - Código de la categoria que queremos traer.
     */
    _get_primera_categoria() {
        const categoria = this.get_categorias_one({ sorted: "posicion" });
        return categoria;
    }

    /**
     * Devuelve las categorías hijas de un candidato.
     *
     * @param {*} candidato - Candidato a partir del cual se obtienen las categorías hijas.
     * @returns {Array} - Categorías hijas de un candidato.
     */
    get_categorias_hijas_candidato(candidato) {
        var ret = [];

        var categorias_hijas = this.get_categorias_many({
            adhiere: candidato.cod_categoria,
        });

        if (categorias_hijas.length) {
            for (var j in categorias_hijas) {
                var categoria = categorias_hijas[j];
                if (categoria) {
                    const candidato_hijo = this.get_candidaturas_one({
                        cod_categoria: categoria.codigo,
                        cod_lista: candidato.cod_lista,
                    });
                    if (candidato_hijo) {
                        var cat_hija = [
                            categoria.codigo,
                            candidato_hijo,
                            categoria,
                        ];
                        ret.push(cat_hija);
                    }
                }
            }
        }
        return ret;
    }

    /**
     * Busca candidatos primero por código de lista y luego por código de categoría si no se encuentran resultados.
     *
     * @returns {Array} - Retorna un array con los candidatos encontrados.
     */
    candidaturas_por_categoria_agrupar_cargo() {
        let candidato = this.get_candidaturas_many({
            cod_categoria: constants.agrupar_cargo,
            clase: "Candidato",
        });
        if (candidato.length) {
            return candidato;
        } else {
            var filter_categoria = { sorted: "posicion.0" };
            const categorias = this.get_categorias_many(filter_categoria);
            for (const categoria of categorias) {
                candidato = this.get_candidaturas_many({
                    cod_categoria: categoria.codigo,
                    clase: "Candidato",
                });
                if (candidato.length) {
                    return candidato;
                }
            }
        }
    }

    /**
     * Devuelve la categoria que le pedimos o la primera si no le pedimos ninguna.
     *
     * @param {*} cod_categoria - Código de la categoria que queremos traer.
     */
    _get_one_categoria(cod_categoria) {
        var categoria = null;
        if (typeof cod_categoria === "undefined") {
            categoria = this.get_categorias_one();
        } else {
            categoria = this.get_categorias_one({
                codigo: cod_categoria,
            });
        }
        return categoria;
    }

    /**
     * Indica si el candidato es la unica preferencia para el cargo
     *
     * @param {*} candidato
     */
    candidatura_es_de_preferente_unico(candidato) {
        return (
            candidato.clase === "Blanco" ||
            (!candidato.cargo_ejecutivo &&
                this.cantidad_preferencias(
                    candidato.cod_lista,
                    candidato.cod_categoria
                ) === 1)
        );
    }

    /**
     * Devuelve las preferencias buscando por lista y cargo
     *
     * @param {*} candidato
     */
    get_preferencias(candidato) {
        var filter = {
            clase: "Candidato",
            cod_lista: candidato.cod_lista,
            cod_categoria: candidato.cod_categoria,
            sorted: "nro_orden",
        };
        return this.get_candidaturas_many(filter);
    }

    cantidad_preferencias(cod_lista, cod_categoria) {
        var filter = {
            cod_lista: cod_lista,
            cod_categoria: cod_categoria,
        };
        var candidaturas = this.get_candidaturas_many(filter);
        return candidaturas.length;
    }

    candidatura_es_especial(candidatura) {
        return (
            candidatura.clase === "Blanco" || candidatura.clase === "Especial"
        );
    }

    categoria_es_de_preferente_unico(categoria) {
        let local_data = this.get_local_data();
        return local_data.candidaturas._data
            .filter(
                (candidatura) =>
                    candidatura.cod_categoria === categoria.codigo &&
                    !this.candidatura_es_especial(candidatura)
            )
            .every((candidatura) =>
                this.candidatura_es_de_preferente_unico(candidatura)
            );
    }

    /**
     * Toma cod_lista si encuentra candidato, lo retorna, sino busca cod_lista por
     * codigo de categoria.
     *
     * @param {*} cod_lista - Código de lista seleccionado, o el id de un candidato en caso de agrupar por cargo.
     */
    get_boletas_lista(cod_lista) {
        var cod_categoria = constants.agrupar_cargo;
        var filter = { lista_completa: true };
        // // Busco todas las boletas que tengan ese candidato
        let candidato = this.get_candidaturas_one({ codigo: cod_lista });
        let _ultima_selec_cod_lista =
            localController.seleccion.get_ultima_seleccion_cod_lista();
        if (typeof candidato == "undefined") {
            // Si el candidato no esta definido, estoy en presencia de
            // agrupaciones municipales
            filter["agrupacion_nivel_ubicacion"] = true;
        } else {
            filter[cod_categoria] = candidato.id_umv;
            if (_ultima_selec_cod_lista == null) {
                localController.seleccion.set_ultima_seleccion_cod_lista(
                    candidato.id_umv
                );
            }
        }
        let boletas = this.get_boletas_many(filter);
        if (boletas.length) {
            return boletas;
        } else {
            filter = { lista_completa: true };
            var filter_categoria = { sorted: "posicion.0" };
            const categorias = this.get_categorias_many(filter_categoria);
            for (const categoria of categorias) {
                var cod_categoria = categoria.codigo;
                filter[cod_categoria] = candidato.id_umv;
                boletas = this.get_boletas_many(filter);
                if (boletas.length) {
                    return boletas;
                }
            }
        }
    }

    /**
     * Devuelve el objeto lista de un candidato.
     *
     * @param {*} candidato - Candidato del cual se quiere generar un objeto candidato.
     * @returns {any} - Objeto lista de un candidato.
     */
    get_lista_candidato(candidato) {
        return this.get_agrupaciones_one({
            id_candidatura: candidato.cod_lista,
        });
    }

    /**
     * Devuelve el objeto lista para una boleta.
     *
     * @param {*} boleta - Boleta de la cual se quiere generar un objeto boleta.
     * @returns {any} - Objeto lista para una boleta.
     */
    get_lista_boleta(boleta) {
        return this.get_agrupaciones_one({ id_candidatura: boleta.codigo });
    }

    /**
     * Devuelve el objeto partido de un candidato.
     *
     * @param {*} candidato - Candidato a partir del cual se quiere generar un objeto partido.
     * @returns {any} - Objeto partido de un candidato.
     */
    get_partido_candidato(candidato) {
        return this.get_agrupaciones_one({
            id_candidatura: candidato.cod_partido,
        });
    }

    /**
     * Devuelve el objeto alianza de un candidato.
     *
     * @param {*} candidato - Candidato a partir del cual se quiere generar un objeto alianza.
     * @returns {any} - Objeto alianza de un candidato.
     */
    get_alianza_candidato(candidato) {
        return this.get_agrupaciones_one({
            id_candidatura: candidato.cod_alianza,
        });
    }

    /**
     * Devuelve los candidatos de una boleta ordenados por orden de categoria.
     *
     * @param {*} boleta - Objeto boleta que contiene los candidatos.
     * @returns {Array} - Candidatos de una boleta ordenados por orden de categoria.
     */
    get_candidatos_boleta(boleta) {
        var ordenados = [];
        var categorias = this.get_categorias_many({
            consulta_popular: false,
        });
        for (var i in categorias) {
            var categoria = categorias[i];
            var candidato = this.get_candidaturas_one({
                id_umv: boleta[categoria.codigo],
            });
            if (typeof candidato === "undefined") {
                candidato = this.get_candidaturas_one({
                    clase: "Blanco",
                    cod_categoria: categoria.codigo,
                });
                if (typeof candidato !== "undefined") {
                    candidato.es_blanco = true;
                }
            }
            if (
                typeof categoria !== "undefined" &&
                typeof candidato !== "undefined"
            ) {
                candidato.categoria = categoria;
            }
            ordenados.push(candidato);
        }

        return ordenados;
    }

    /**
     * Devuelve todos los partidos que tengan alguna lista completa.
     *
     * @returns {Array} - Partidos que tengan alguna lista completa.
     */
    get_partidos_con_listas() {
        var partidos = [];
        var cods_partidos = [];
        var boletas = this.get_boletas_many({ lista_completa: true });
        for (var i in boletas) {
            var boleta = boletas[i];
            if (
                typeof boleta.lista !== "undefined" &&
                cods_partidos.indexOf(boleta.lista.cod_partido) == "-1"
            ) {
                cods_partidos.push(boleta.lista.cod_partido);
            }
        }

        for (var j in cods_partidos) {
            var cod_partido = cods_partidos[j];
            var partido = this.get_agrupaciones_one({ codigo: cod_partido });
            partidos.push(partido);
        }

        return partidos;
    }

    /**
     * Indica si la categoria del candidato tiene preferentes
     *
     * @param {*} candidato
     * @returns {Boolean}
     */
    es_candidato_con_preferentes(candidato) {
        let categoria = this.get_categorias_one({
            codigo: candidato.cod_categoria,
        });
        return categoria.max_preferencias > 0;
    }

    /**
     * Si esta configurado para aleatorizar los candidatos solo cuando el
     * elector inserta la boleta vamos a shufflear todo.
     *
     */
    shuffle_local_data() {
        let local_data = this.get_local_data();
        local_data.candidaturas._data = shuffle(local_data.candidaturas._data);
        local_data.agrupaciones._data = shuffle(local_data.agrupaciones._data);
        local_data.boletas._data = shuffle(local_data.boletas._data);
        this.set_local_data(local_data);
    }

    get_codigos_cargos() {
        return this.dataService.codigos_cargos();
    }

    /**
     * Funcion que valida si una ubicacion es mixta.
     *
     * @param {*} categorias - Objeto con todas las categorias.
     * @param {*} cargos_nivel_no_ubicacion - array de cargos
     * @param {*} cargos_nivel_ubicacion - array de cargos
     * @returns {Boolean} - retorna booleano para determinas si la ubicacion es mixta.
     */
    ubicacion_mixta(
        categorias,
        cargos_nivel_no_ubicacion,
        cargos_nivel_ubicacion
    ) {
        const existe_cargos_nivel_no_ubicacion = cargos_nivel_no_ubicacion.some(
            (codigo) => categorias.some((obj) => obj.codigo === codigo)
        );

        const existe_cargos_nivel_ubicacion = cargos_nivel_ubicacion.some(
            (codigo) => categorias.some((obj) => obj.codigo === codigo)
        );

        return (
            existe_cargos_nivel_no_ubicacion && existe_cargos_nivel_ubicacion
        );
    }

    /**
     * Funcion que analiza cada boleta para determinar si contiene ningun cargos_nivel_no_ubicacion
     * pero si algun cargos_nivel_ubicacion.
     * Y asi asigna un valor a la propiedad "agrupacion_nivel_ubicacion"
     * basandose en la validacion de las tres variables.
     *
     * @param {*} categorias - Objeto con todas las boletas.
     * @param {*} cargos_nivel_no_ubicacion - array de cargos
     * @param {*} cargos_nivel_ubicacion - array de cargos
     * @param {*} ubicacion_mixta - booleano que indica si la ubicación es mixta.
     */
    nivel_boleta(
        boletas,
        cargos_nivel_no_ubicacion,
        cargos_nivel_ubicacion,
        ubicacion_mixta
    ) {
        for (let j in boletas) {
            let boletas_nivel = boletas[j];

            const boletaKeys = Object.keys(boletas_nivel);
            const boletas_nivel_no_ubicacion = cargos_nivel_no_ubicacion.every(
                (cargo) => !boletaKeys.includes(cargo)
            );

            const boletas_nivel_ubicacion = cargos_nivel_ubicacion.some(
                (cargo) => boletaKeys.includes(cargo)
            );

            boletas[j].agrupacion_nivel_ubicacion =
                ubicacion_mixta &&
                boletas_nivel_no_ubicacion &&
                boletas_nivel_ubicacion;
        }
    }

    /**
     * La función agrupacion_nivel_ubicacion utiliza constantes para definir
     * los cargos relacionados y no relacionados con la ubicación. Luego, obtiene todas
     * las categorías y boletas disponibles. A continuación, determina si la ubicación
     * es mixta utilizando una función ubicacion_mixta, pasando las categorías y las
     * constantes de cargos relacionados y no relacionados con la ubicación. Finalmente,
     * utiliza otra función llamada nivel_boleta para procesar las boletas, pasando las boletas,
     * las constantes de cargos y el resultado de la verificación de ubicación mixta.
     */
    agrupacion_nivel_ubicacion() {
        const cargos_nivel_no_ubicacion =
            constants.boleta_agrupacion.cargos_nivel_no_ubicacion;
        const cargos_nivel_ubicacion =
            constants.boleta_agrupacion.cargos_nivel_ubicacion;
        let categorias = this.get_all_categorias();
        let boletas = this.get_all_boletas();
        const ubicacion_mixta = this.ubicacion_mixta(
            categorias,
            cargos_nivel_no_ubicacion,
            cargos_nivel_ubicacion
        );
        this.nivel_boleta(
            boletas,
            cargos_nivel_no_ubicacion,
            cargos_nivel_ubicacion,
            ubicacion_mixta
        );
    }
}
