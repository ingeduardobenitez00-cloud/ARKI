/**
 * @namespace js.sufragio.localController.seleccion
 */

/* 
    El archivo seleccion.js contiene estados, datos y funciones relacionados con la seleccion dentro de sufragio.
*/

class Seleccion {
    #seleccion;
    constructor() {
        this.seleccion = {};
        this.tachas_tmp = null;
        this.preferencias_tmp = null;
        this.ultima_categoria_votada = null; //a pedido del licenciado Mathias
        this.ultima_seleccion_cod_lista = null;
        this.votando = false;
        this.agrupar_cargo = false;
    }

    _get_seleccion() {
        return this.#seleccion;
    }

    _set_seleccion(seleccion) {
        this.#seleccion = seleccion;
    }

    get_tachas_tmp() {
        return this.tachas_tmp;
    }

    set_tachas_tmp(tachas_tmp) {
        this.tachas_tmp = tachas_tmp;
    }

    get_preferencias_tmp() {
        return this.preferencias_tmp;
    }

    set_preferencias_tmp(preferencias_tmp) {
        this.preferencias_tmp = preferencias_tmp;
    }

    get_ult_cat_votada() {
        return this.ult_cat_votada;
    }

    set_ult_cat_votada(ult_cat_votada) {
        this.ult_cat_votada = ult_cat_votada;
    }

    get_votando() {
        return this.votando;
    }

    set_votando(_votando) {
        this.votando = _votando;
    }

    get_agrupar_cargo() {
        return this.agrupar_cargo;
    }

    set_agrupar_cargo(agrupar_cargo) {
        this.agrupar_cargo = agrupar_cargo;
    }

    get_seleccion() {
        return this.seleccion;
    }

    set_seleccion(seleccion) {
        this.seleccion = seleccion;
    }

    get_ultima_seleccion_cod_lista() {
        return this.ultima_seleccion_cod_lista;
    }

    set_ultima_seleccion_cod_lista(ultima_seleccion_cod_lista) {
        this.ultima_seleccion_cod_lista = ultima_seleccion_cod_lista;
    }    
    /**
     * Inicializa el estado cuando el elector ingresa una boleta
     */
    inicializar_estado_voto() {
        this.set_votando(true);
        localController.cambio_valor_local_data("cargando_preferencias", false);
    }

    /**
     * Limpia la seleccion, borra la categoria actual.
     */
    limpiar_seleccion() {
        this.set_seleccion({});
        this.set_preferencias_tmp(null);
        this.set_tachas_tmp(null);
        // Resetea el flag de confirmacion para una nueva votación
        const local_data = localController.businessData.get_local_data();
        local_data.llego_a_confirmacion = false;
        localController.businessData.set_local_data(local_data);
        cambiar_categoria(null);
    }

    /**
     * Selecciona candidatos.
     *
     * @param {*} categoria - Categoria para la cual queremos seleccionar a los candidatos.
     * @param {*} codigos - Códigos de los candidatos que queremos seleccionar.
     */
    seleccionar_candidatos(categoria, codigos) {
        // Actualiza el diccionario de candidatos seleccionados.
        let local_data = localController.businessData.get_local_data();
        let _seleccion = this.get_seleccion();
        let tachas_tmp = this.get_tachas_tmp();
        if (!local_data.cargando_preferencias)
            _seleccion[categoria.codigo] = codigos;
        if (codigos.length == 1) {
            var candidato = localController.businessData.get_candidaturas_one({
                id_umv: codigos[0],
            });
            for (var i in candidato.categorias_hijas) {
                var cat_hija = candidato.categorias_hijas[i];
                _seleccion[cat_hija[0]] = [cat_hija[1].id_umv];
            }
        }

        var next_cat = localController.next_cat_vacia();

        // Esto significa que hay preferencias para esa categoria y podría ser
        // util ingresar automáticamente
        if (typeof _seleccion.preferencias === "undefined")
            _seleccion.preferencias = {};

        //si la categoria posee preferencias y selecciono blanco limpio
        //las preferencias de esa categoria
        if (
            candidato.id_candidatura == "BLC" &&
            typeof categoria.max_preferencias !== "undefined"
        )
            _seleccion.preferencias[categoria.codigo] = [];

        if (
            typeof categoria.max_preferencias !== "undefined" &&
            constants.preferencias_en_seleccion &&
            candidato.id_candidatura != "BLC"
        ) {
            if (this.get_preferencias_tmp() == null) {
                const candidato =
                    localController.businessData.get_candidaturas_one({
                        id_umv: codigos[0],
                    });
                const seleccionar_preferente_unico =
                    localController.businessData.candidatura_es_de_preferente_unico(
                        candidato
                    ) &&
                    localController.businessData.categoria_es_de_preferente_unico(
                        categoria
                    );
                if (seleccionar_preferente_unico) {
                    _seleccion.preferencias[categoria.codigo] = [];
                    const fake_dom_element = document.createElement("div");
                    localController.toggle_array_candidato(
                        categoria.max_preferencias,
                        fake_dom_element,
                        _seleccion.preferencias[categoria.codigo],
                        String(candidato.id_umv)
                    );
                } else {
                    local_data.cargando_preferencias = true;
                    if (typeof _seleccion.preferencias[categoria.codigo] === "undefined") {
                        _seleccion.preferencias[categoria.codigo] = [];
                    }
                    if (!constants.asistida) {
                        setTimeout(function () {
                            cargar_pantalla_preferencias(candidato);
                        }, constants.tiempo_feedback);
                    } else {
                        cargar_preferencias_candidato_asistida(candidato);
                    }
                    this.set_seleccion(_seleccion);
                    return;
                }
            } else {
                _seleccion.preferencias[categoria.codigo] = this.get_preferencias_tmp();
                this.set_preferencias_tmp(null);
                local_data.cargando_preferencias = false;
            }
            // Esto significa que hay tachas para esa categoria y podría ser
            // util ingresar automáticamente
        } else if (
            typeof categoria.max_tachas !== "undefined" &&
            constants.tachas_en_seleccion &&
            candidato.id_candidatura != "BLC"
        ) {
            if (tachas_tmp == null) {
                var candidato =
                    localController.businessData.get_candidaturas_one({
                        id_umv: codigos[0],
                    });

                if (!constants.asistida) {
                    setTimeout(function () {
                        // Borro todas las tachas antiguas.
                        _seleccion.tachas = [];
                        cargar_pantalla_tachas(candidato);
                    }, constants.tiempo_feedback);
                } else {
                    cargar_tachas_candidato_asistida(candidato);
                }
            } else {
                _seleccion.tachas = tachas_tmp;
                this.set_tachas_tmp(null);
            }
            this.set_seleccion(_seleccion);
            return;
        }
        this.set_seleccion(_seleccion);
        if (next_cat) {
            var next_func =
                localController._cargar_candidatos_categoria.bind(
                    localController
                );
            // si la proxima es una consulta_popular pasamos al modo consulta
            // sino seguimos cargando las categorias
            if (next_cat.consulta_popular) {
                next_func =
                    localController._cargar_candidatos_consulta_popular.bind(
                        localController
                    );
            }
            setTimeout(function () {
                next_func(next_cat);
            }, constants.tiempo_feedback);
        } else {
            // Esto carga la confirmacion y le manda la seleccion al backend para,
            // en caso de usarse precache de impresion se empiece a cachear
            setTimeout(function () {
                localController._cargar_confirmacion(_seleccion);
            }, constants.tiempo_feedback);
        }
    }

    /**
     * Selecciona una lista y decide para donde seguir.
     *
     * @param {*} cod_lista - Código de lista seleccionado, o el id de un candidato en caso de agrupar por cargo.
     */
    seleccion_lista(cod_lista) {
        // Buscamos la "boleta virtual" de esta lista.
        var boleta = localController.businessData.get_boletas_one({
            codigo: cod_lista,
        });
        let _seleccion = this.get_seleccion();

        if (typeof boleta === "undefined") {
            // Si esta lista no tiene boleta virtual
            if (cod_lista == constants.cod_lista_blanco) {
                // Si la lista es una lista de voto en blanco buscamos la boleta de
                // voto en blanco.
                boleta = local_data.boletas.one({
                    codigo: constants.cod_lista_blanco,
                });
                var categorias =
                    localController.businessData.get_categorias_many({
                        consulta_popular: false,
                    });
                // Recorremos todas las categorias que no son consultas populares y
                // las llenamos de los id_umv de esa lista en blanco.
                for (var i in categorias) {
                    let categoria = categorias[i];
                    var id_umv = boleta[categoria.codigo];
                    _seleccion[categoria.codigo] = [id_umv];
                }
                this.set_seleccion(_seleccion);
            } else if (constants.agrupar_cargo) {
                // En cambio si estamos agrupando en por cargo vamos a usar ese
                // codgio de categoria como id del candidato
                let candidato =
                    localController.businessData.get_candidaturas_one({
                        codigo: cod_lista,
                    });
                let data =
                    localController.businessData.get_boletas_lista(cod_lista);

                /* Si tiene un codigo de alianza le agrego una clave alianza con los datos de la agrupacion de dicha alianza */
                let filter = [];
                filter["clase"] = "Alianza";
                let filter_data = [];
                for (var idx in data) {
                    var cod_alianza = data[idx].lista.cod_alianza;
                    if (cod_alianza) {
                        filter["codigo"] = cod_alianza;
                        let alianza =
                            localController.businessData.get_agrupaciones_many(
                                filter
                            );
                        data[idx]["alianza"] = alianza[0];
                    }
                    if (!typeof constants.no_mostrar_lista_cod) {
                        if (
                            !constants.no_mostrar_lista_cod.includes(
                                data[idx].codigo
                            )
                        ) {
                            filter_data.push(data[idx]);
                        }
                    } else {
                        filter_data.push(data[idx]);
                    }
                }
                data = filter_data;
                filter_data = [];

                // Si hay una sola lista completa que tenga ese candidato la vamos
                // a elegir. En algunos lugares pueden quererer que este
                // comportamiento no se automatico.
                if (data.length == 1 && constants.seleccionar_lista_unica) {
                    seleccionar_lista(data[0].codigo);
                } else if (data.length > constants.colapsar_listas) {
                    // Si cantidad de listas es mayor a la configruacion de
                    // colapsar_listas vamos a buscar los partidos los cuales
                    // tienen alguna lista que lleva a ese candidato.
                    var ids_partidos = [];
                    var partidos = [];
                    for (var k in data) {
                        var cod_partido = data[k].lista.cod_partido;
                        if (ids_partidos.indexOf(cod_partido) == "-1") {
                            ids_partidos.push(cod_partido);
                            partidos.push(
                                localController.businessData.get_partido_candidato(
                                    data[k].lista
                                )
                            );
                        }
                    }
                    // Cargamos los partidos en pantalla.
                    if (constants.asistida) {
                        cargar_partidos_completa_asistida({
                            partidos: partidos,
                        });
                    } else {
                        cargar_partidos_completa({ partidos: partidos });
                        solapa(candidato);
                    }
                } else {
                    // Si la cantidad de listas entra en pantalla las cargamos
                    // directamente en pantalla como una pantalla de listas.
                    if (constants.asistida) {
                        cargar_listas_asistida(data);
                    } else {
                        let hay_frentes =
                            typeof constants.candidato_muestra_frente !=
                                "undefined" &&
                            constants.candidato_muestra_frente.includes(
                                cod_lista
                            );
                        cargar_listas(data, true, false, hay_frentes);
                        if (typeof candidato !== "undefined") {
                            const cargo = candidato["categoria"]["nombre"];
                            let candidato_modificado = JSON.parse(
                                JSON.stringify(candidato)
                            );
                            candidato_modificado["categoria"]["nombre"] =
                                cargo === "Gobernador y Vice"
                                    ? "Gobernador"
                                    : cargo;
                            solapa(candidato_modificado);
                        } else {
                            solapa(candidato);
                        }
                    }
                }
                // salimos de la funcion parar que no cargue la confirmacion.
                return;
            }
        } else {
            // si la boleta está definida quiere decir que  tenemos que seleccionar
            // los candidatos de esa lista.
            var candidatos =
                localController.businessData.get_candidatos_boleta(boleta);
            for (var j in candidatos) {
                let candidato = candidatos[j];
                if (typeof candidato != "undefined") {
                    _seleccion[candidato.cod_categoria] = [candidato.id_umv];
                }
            }

            let categorias = localController.businessData.get_categorias_many({
                consulta_popular: false,
            });
            // Si la lista no es totalmente completa vamos a rellenar con voto en
            // blanco las categorias tengan candidato para voto en Blanco.
            for (const k in categorias) {
                var categoria = categorias[k];
                var sel = _seleccion[categoria.codigo];
                if (typeof sel === "undefined") {
                    var blanco =
                        localController.businessData.get_candidaturas_one({
                            cod_categoria: categoria.codigo,
                            clase: "Blanco",
                        });
                    if (blanco) {
                        _seleccion[categoria.codigo] = [blanco.id_umv];
                    }
                }
            }
        }
        this.set_seleccion(_seleccion);
        setTimeout(function () {
            // Si tenemos alguna categoria vacia y la misma es una consulta_popular
            // vamos a cargar la pantalla de consulta_popular, sino vamos a cargar
            // la pantalla de confirmacion.
            var next_cat = localController.next_cat_vacia();
            if (next_cat && next_cat.consulta_popular) {
                localController._cargar_candidatos_consulta_popular(next_cat);
            } else {
                localController._cargar_confirmacion(_seleccion);
            }
        }, constants.tiempo_feedback);
    }

    /**
     * Selecciona un partido. Sirve tanto para lista completa como para
     * categorias. Por lo tanto dirige el flujo del software segun el contexto
     * en el que haya sido llamado.
     *
     * @param {*} codigo - Código del partido o candidato de una categoria adherida.
     * @param {*} categoria - Categoría para la cual queremos seleccionar el partido.
     */
    seleccionar_partido(codigo, categoria) {
        /*
         * Argumentos:
         * codigo --
         * categoria -- la
         */
        if (categoria === null || typeof categoria === "undefined") {
            // Cargamos la pantalla de lista completa.
            localController._cargar_pantalla_lista_completa(codigo);
        } else {
            // cargamos los candidatos de la categoria que elegimos.
            localController._cargar_candidatos_categoria(categoria, codigo);
        }
    }
}
