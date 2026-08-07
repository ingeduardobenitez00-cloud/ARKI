/**
 * @namespace js.sufragio.localController
 */

/* 
    Este archivo localController.js encapsula una serie de funciones esenciales 
    relacionadas con el proceso de votación
*/

class LocalController {
    constructor(businessData, sufragio) {
        this.businessData = businessData;
        this.seleccion = sufragio;
    }

    /**
     * Establece los datos dentro de DataService, preprocesa los candidatos para
     * establecerle las categorias hijas y asigna la lista a las "Boletas
     * virtuales". Esto es lo que pasa durante la pantalla de carga del modulo,
     * cuando se abre el modulo. Puede tardar unos segundos.
     *
     * @param {*} data - Un diccionario con los datos que vienen del backend. Las key que manda son "categorias", "candidaturas", "agrupaciones", "boletas".
     */
    cargar_datos(data) {
        let local_data = this.businessData.get_local_data();
        local_data.categorias = new Chancleta(data.categorias);
        local_data.candidaturas = new Chancleta(data.candidaturas);
        local_data.agrupaciones = new Chancleta(data.agrupaciones);
        local_data.boletas = new Chancleta(data.boletas);
        this.businessData.set_local_data(local_data);

        //Traigo todos los candidatos y preproceso un poco el objeto para hacerlo
        //una vez y que la experiencia de votacion sea mas fluida y de paso ahorrar
        //un poco de procesamiento.
        let candidaturas = this.businessData.get_candidaturas_many({
            clase: "Candidato",
        });

        for (const i in candidaturas) {
            let candidatura = candidaturas[i];
            // le linkeo la lista a la candidatura si la tiene.
            // Devuelve el objeto lista para una boleta.
            if (candidatura.cod_lista) {
                candidatura.lista =
                    this.businessData.get_lista_candidato(candidatura);
            }
            // le linkeo el partido a la candidatura si lo tiene.
            //Devuelve el objeto partido de un candidato.
            if (candidatura.cod_partido) {
                candidatura.partido =
                    this.businessData.get_partido_candidato(candidatura);
            }
            // le linkeo la lista a la candidatura si la tiene.
            // Devuelve el objeto alianza de un candidato.
            if (candidatura.cod_alianza) {
                candidatura.alianza =
                    this.businessData.get_alianza_candidato(candidatura);
            }
            // Busco las categorias hijas de esa candidatura
            candidatura.categorias_hijas =
                this.businessData.get_categorias_hijas_candidato(candidatura);
            if (
                constants.precachear_imagenes &&
                candidatura.imagenes != undefined
            ) {
                precachear_imagen(candidatura.imagenes[0]);
            }
        }

        // Agregando las categorias_hijas al voto en blanco.
        var blancos = this.businessData.get_candidaturas_many({
            clase: "Blanco",
        });
        for (const i in blancos) {
            let candidatura = blancos[i];
            candidatura.categorias_hijas =
                this.businessData.get_categorias_hijas_candidato(candidatura);
        }

        if (constants.precachear_imagenes) {
            var agrupaciones = this.businessData.get_all_agrupaciones();
            for (var k in agrupaciones) {
                var agrupacion = agrupaciones[k];
                precachear_imagen(agrupacion.imagenes[0]);
            }
        }

        // Recorro todas las "Boletas Virtuales" y le hago un shortcut a la lista
        // de manera que cuando lo busque despues lo tenga a mano.
        var boletas = this.businessData.get_all_boletas();
        for (var j in boletas) {
            var boleta = boletas[j];
            if (boleta.codigo) {
                // Devuelve el objeto lista para una boleta.
                boleta.lista = this.businessData.get_lista_boleta(boleta);
            }
        }

        if (constants.muestra_boton_agrupacion) {
            this.businessData.agrupacion_nivel_ubicacion();
        }
        // Ya puden empezar a votar.
        //oculta el loader y inicializa las primeras pantallas de votacion
        ocultar_loader();
    }

    /**
     * Selecciona el modo de votacion y actua en consecuencia.
     *
     * @param {string} modo - Un string con el modo de votacion.
     */
    seleccionar_modo(modo) {
        // Esto fuerza el reseteo del objeto seleccion del Controller del modulo
        // sufragio.
        guardar_modo(modo);
        send("reiniciar_seleccion");
        // Y esto hace lo mismo pero localmente.
        this.seleccion.limpiar_seleccion();
        if (modo == "BTN_CATEG") {
            // Seteo ultima seleccion en null porque hay casos en que "volver atras" pasa por acá y no por
            // la pantalla de elegir tipo votacion : lista completa o por categoria
            _ultima_selec_cod_lista = null;
            // Si votamos por categorias vamos directo a cargar la pantalla de
            // categorias.
            this._cargar_pantalla_categorias();
        } else if (modo == "BTN_COMPLETA") {
            // Si votamos por lista completa tenemos que ver si tenemos que agrupar
            // por cargo o colapsar las listas en agrupaciones por si es una PASO o
            // es una eleccion en la que decidimos agrupar por cargo ejecutivo.
            // Por defecto vamos a la tipica pantalla de lista completa, a menos
            // que se de alguna condicion que requiera ir a la pantalla de
            // agrupacion por partidos.
            // Seteo ultima seleccion en null porque hay casos en que "volver atras" pasa por acá y no por
            // la pantalla de elegir tipo votacion : lista completa o por categoria
            this.seleccion.set_ultima_seleccion_cod_lista(null);
            var func = this._cargar_pantalla_lista_completa.bind(this);
            if (constants.colapsar_listas && !constants.agrupar_cargo) {
                // Buscamos todas las boletas que tengan que aparecer en la
                // pantalla de lista completa
                // var data = local_data.boletas.many({
                var data = this.businessData.get_boletas_many({
                    lista_completa: true,
                });
                // Tenemos que tener en cuenta el voto en blanco para no colapsar
                // las listas de manera diferente si tenemos voto en blanco como
                // opcion de lista completa en algun lugar (lo cual es lo tipico).
                var len_listas = data.length;
                for (var i in data) {
                    if (data.clase == "Blanco") {
                        len_listas -= 1;
                    }
                }
                // nos fijamos si debemos colapsar las listas en partidos o no.
                const colapsar_listas = constants.colapsar_listas;
                if (len_listas > colapsar_listas) {
                    // Si tenemos que colapsar entonces vamos a mostrar la pantalla
                    // de partidos en vez de la de listas.
                    func = this._cargar_pantalla_partidos.bind(this);
                }
            }
            func();
        }
    }

    /**
     * Carga la pantalla inicial cuando un elector mete una boleta.
     * Toma la decision de qué pantalla mostrar segun el contexto. Las salidas
     * en general pueden ser 4:
     *   1) la pantalla de seleccion de modo de votacion.
     *   2) la pantalla de votar por categorias.
     *   3) la pantalla de lista completa.
     *   4) la pantalla de consulta_popular.
     */
    cargar_pantalla_inicial() {
        this.seleccion.inicializar_estado_voto();
        // Si esta configurado para aleatorizar los candidatos solo cuando el
        // elector inserta la boleta vamos a shufflear todo.
        if (constants.shuffle.por_sesion) {
            this.businessData.shuffle_local_data();
        }
        // Ocultamos el dialogo de error de grabacion, en caso de que alguien en
        // vez de tocar el boton de aceptar haya decidido meter una boleta nueva.
        hide_dialogo();
        // traemos los botones que tenemos que mostrar de las constantes.
        var botones = constants.botones_seleccion_modo;
        // Establecemos que no vamos, por ahora, a votar por categorias, por
        // descarte.
        var fallback = false;

        // Si tenemos configurados qué botones usamos.
        if (botones !== null) {
            var cantidad = botones.length;
            // Nos fijamos que categorias que no sean consultas populares se votan.
            var categorias = this.businessData.get_categorias_many({
                consulta_popular: false,
                adhiere: null,
            });

            if (!cantidad) {
                // si los botones estan establecidos pero el array está vacio
                // vamos a votar por categorias.
                fallback = true;
            } else if (cantidad == 1) {
                // Si tenemos un solo boton configurado seleccionamos ese modo, por
                // que para qué mostrar una pantalla con un solo boton.
                if (botones[0] == "BTN_COMPLETA") {
                    set_unico_modo(true);
                }
                this.seleccionar_modo(botones[0]);
            } else if (categorias.length > 1) {
                // Si hay mas de una categoria vamos a cargar la pantalla de
                // seleccion de modos
                this._cargar_pantalla_modos(botones);
            } else {
                var primera_cat = this.businessData._get_one_categoria();
                // Si la primera categoria es una consulta_popular quiere decir que
                // solo tenemos consultas populares en esta ubicacion, por lo tanto
                // la vamos a mostrar como tal.
                if (primera_cat != null && primera_cat.consulta_popular) {
                    // mostrarmos la pantalla de consulta popular con la categoria.
                    this.seleccion.limpiar_seleccion();
                    this._cambiar_categoria(primera_cat.codigo);
                } else {
                    // si llegamos a este punto quiere decir que tenemos una sola
                    // categoria que no es consulta popular, por lo tanto vamos con
                    // el fallback a votar por categorias.
                    fallback = true;
                }
            }
        } else {
            // Si no tenemos configurados que botones usamos vamos a votar solo por
            // categorias
            fallback = true;
        }

        // Nos fijamos si fallbackeamos a una sola categoria.
        if (fallback) {
            // Cargamos modo a "votar por categorias".
            set_unico_modo(true);
            this.seleccionar_modo("BTN_CATEG");
        }
    }

    /**
     * Carga la pantalla de modos dependiendo si estamos en votacion asistida o no.
     *
     * @param {*} botones - los botones que queremos mostrar en la pantalla.
     */
    _cargar_pantalla_modos(botones) {
        if (constants.asistida) {
            pantalla_modos_asistida();
        } else {
            pantalla_modos(botones);
        }
    }

    /**
     * Carga la pantalla de categorias,
     * trae la primera categoria que encuentra y se la pasa a la funcion que
     * carga los candidatos de una categoria.
     */
    _cargar_pantalla_categorias() {
        var primera_categoria = this.businessData._get_one_categoria();
        this._cargar_candidatos_categoria(primera_categoria);
    }

    /**
     * Carga la pantalla de partidos en asistida o en sufragio normal.
     */
    _cargar_pantalla_partidos() {
        // Traigo todos los partidos que tienen alguna lista y armo un diccionario
        // que la pantalla de cargar partidos en lista completa sepa leer.
        var partidos = this.businessData.get_partidos_con_listas();
        var data = { partidos: partidos };
        if (constants.asistida) {
            cargar_partidos_completa_asistida(data);
        } else {
            cargar_partidos_completa(data);
        }
    }

    /**
     * Carga la pantalla de lista completa.
     *
     * @param {*} cod_partido - Código de un partido si solo se quieren mostrar las listas de una categoria.
     */
    _cargar_pantalla_lista_completa(cod_partido) {
        // si la mesa extranjera y la config para que no agrupe por cargo en estos caso es true
        // pone en true no_agrupar_cargo_extranjera para que no entre al if de constants.agrupar_cargo
        var no_agrupar_cargo_extranjera = false;
        let validacion_agrupar_cargo = false;
        if (
            typeof constants.mesa_ext_no_agrupar_cargo !== "undefined" &&
            typeof constants.cod_datos !== "undefined" &&
            constants.mesa_ext_no_agrupar_cargo &&
            constants.cod_datos.includes("EXT")
        ) {
            no_agrupar_cargo_extranjera = true;
        }
        validacion_agrupar_cargo = no_agrupar_cargo_extranjera
            ? false
            : constants.agrupar_cargo;
        // Armamos el filtro por defecto con el que vamos a filtrar las listas.

        var agrupar_cargo = this.businessData.get_categorias_first().codigo;
        var hay_agrupacion_nivel_ubicacion = false;
        // Armamos el filtro por defecto con el que vamos a filtrar las listas.
        this.seleccion.set_agrupar_cargo(false);
        var filter = {
            lista_completa: true,
        };

        var data = null;
        let _ultima_selec_cod_lista =
            localController.seleccion.get_ultima_seleccion_cod_lista();
        if (typeof cod_partido !== "undefined") {
            // Si el codigo del partido está definido Buscamos todas las listas
            // completas disponibles
            if (_ultima_selec_cod_lista != null && validacion_agrupar_cargo) {
                filter[agrupar_cargo] = _ultima_selec_cod_lista;
            }
            var todas_las_boletas = this.businessData.get_boletas_many(filter);
            // vamos a filtrar las listas que sean de este partido.
            let boletas = [];
            for (var i in todas_las_boletas) {
                var boleta = todas_las_boletas[i];
                var lista = boleta.lista;
                if (
                    typeof lista !== "undefined" &&
                    lista.cod_partido == cod_partido
                ) {
                    boletas.push(boleta);
                } else if (
                    typeof lista === "undefined" &&
                    boleta.codigo == "BLC" &&
                    constants.mostrar_blanco_siempre
                ) {
                    boletas.push(boleta);
                }
            }
            // La data que vamos a devolver van a ser esas listas de este partido.
            data = boletas;
        } else if (validacion_agrupar_cargo) {
            // En caso de agrupar_cargo lo primero que hacermos es buscar todos los
            // candidatos que se presenten por la categoria que queremos agrupar.

            data = this.businessData.candidaturas_por_categoria_agrupar_cargo();
            var agrupacion_nivel_ubicacion = this.businessData.get_boletas_many(
                {
                    agrupacion_nivel_ubicacion: true,
                    lista_completa: true,
                }
            );
            if (
                agrupacion_nivel_ubicacion.length &&
                "muestra_boton_agrupacion" in constants &&
                constants.muestra_boton_agrupacion
            ) {
                hay_agrupacion_nivel_ubicacion = true;
            }
            // vamos a buscar si hay un candidato blanco para la categoria en
            // cuestion para ademas mostrar el voto en blanco.
            var blanco = this.businessData.get_candidaturas_one({
                cod_categoria: data[0].cod_categoria,
                clase: "Blanco",
            });
            // Si efectivamente tenemos esa candidatura en blanco lo agregamos a
            // las candidaturas que devolvemos.
            if (blanco) {
                data.push(blanco);
            }
            this.seleccion.set_agrupar_cargo(true);
        } else {
            // En caso de que no filtremos por partido o agrupemos por cargo
            // devolvemos todas las listas completas que encontremos.
            data = this.businessData.get_boletas_many(filter);
        }

        if (data.length == 1 && constants.seleccionar_lista_unica) {
            // si tengo una sola lista completa la selecciono, esto pasa en general
            // cuando seleccionamos un partido o candidatos que tiene una sola
            // lista.
            var codigo_lista =
                data[0].codigo !== "BLC" ? data[0].codigo : data[1].codigo;
            this.seleccion_lista(codigo_lista);
        } else {
            // Si hay mas de una entonces cargamos la pantalla de listas.
            if (constants.asistida) {
                cargar_listas_asistida(
                    data,
                    validacion_agrupar_cargo,
                    hay_agrupacion_nivel_ubicacion
                );
            } else {
                cargar_listas(
                    data,
                    validacion_agrupar_cargo,
                    hay_agrupacion_nivel_ubicacion
                );
                // hace que luego de elegir un partido, la solapa continúe mostrando el GOB elegido en un
                // principio, al haber agrupado por cargo GOB.
                var candidato = this.businessData.get_candidaturas_one({
                    id_umv: _ultima_selec_cod_lista,
                });
                var partido = this.businessData.get_agrupaciones_one({
                    codigo: cod_partido,
                });
                if (candidato) {
                    solapa(candidato, null, partido);
                }
            }
        }
    }

    /**
     * Conecta la funcion desde el back a la funcion de la clase Sufragio.
     *
     * @param {*} cod_lista - Código de lista seleccionado, o el id de un candidato en caso de agrupar por cargo.
     */
    seleccion_lista(cod_lista) {
        this.seleccion.seleccion_lista(cod_lista);
    }

    /**
     * Cambia la categoria que está siendo elegida.
     *
     * @param {*} cod_categoria - Código de la categoria en la que queremos seleccionar candidatos
     */
    _cambiar_categoria(cod_categoria) {
        // Traemos la categoria a la que queremos cambiar.
        var categoria = this.businessData._get_one_categoria(cod_categoria);
        if (categoria.adhiere) {
            // si esa categoria adhiere a otra (por ejemplo como CNJ en la
            // provincia de Buenos Aires que se votan junto con el intendente)
            // vamos a traer la categoria a la que adhiere. Esto en general pasa
            // cuando estamos confirmando una seleccion y hacemos click en el boton
            // modificar de esa categoria, en realidad la que queremos modificar es
            // la categoria a la que adhiere.
            categoria = this.businessData._get_one_categoria(categoria.adhiere);
        }
        // carga los candidatos.
        if (categoria.consulta_popular) {
            this._cargar_candidatos_consulta_popular(categoria);
        } else {
            this._cargar_candidatos_categoria(categoria);
        }
    }

    controller_seleccionar_candidatos(categoria, codigos) {
        this.seleccion.seleccionar_candidatos(categoria, codigos);
    }

    /**
     * Cargamos los candidatos de la categoría.
     *
     * @param {*} categoria - Categoria de la cual queremos cargar los candidatos.
     * @param {*} agrupacion - Agrupacion de la cual queremos mostrar los candidatos en caso de que estemos mostrando solo los candidatos de una agrupacion.
     */
    _cargar_candidatos_categoria(categoria, agrupacion) {
        if (typeof agrupacion === "undefined") {
            agrupacion = false;
        }
        var cod_categoria = categoria.codigo;
        // Cambiamos la categoria a la que quermos votar.
        cambiar_categoria(categoria);
        // cargamos los datos de la barra derecha de categorias.
        this._cargar_datos_barra_categorias();

        var sorted = undefined;
        if (!constants.shuffle.por_sesion && !constants.shuffle.candidatos) {
            sorted = "orden_absoluto.0";
        }
        var filter = {
            cod_categoria: cod_categoria,
            clase: "Candidato",
            sorted: sorted,
        };

        /* En vez de traer todos los candidatos traigo solo uno por categoria en el caso de las preferencias*/
        if (categoria.max_preferencias !== "undefined") {
            //me traigo las listas
            var listas = this.businessData.get_agrupaciones_many({
                clase: "Lista",
                sorted: sorted,
            });
            var candidatos = [];

            //dejo solo las de la categoria actual
            if (typeof listas !== "undefined") {
                for (var i in listas) {
                    if (listas[i].id_candidatura !== "undefined") {
                        let filter = {
                            cod_lista: listas[i].id_candidatura,
                            cod_categoria: cod_categoria,
                            sorted: sorted,
                        };
                        var candidato =
                            this.businessData.get_candidaturas_one(filter);
                        if (candidato) {
                            candidatos.push(candidato);
                        }
                    }
                }
            }
        } else {
            var candidatos = this.businessData.get_candidaturas_many(filter);
        }

        filter.clase = "Blanco";
        // Y nos fijamos si hay algun candidato en blanco.
        var blanco = this.businessData.get_candidaturas_one(filter);
        if (blanco) {
            candidatos.push(blanco);
        }
        // Creamos el diccionario de datos.
        var data_dict = {
            categoria: categoria,
            candidatos: candidatos,
        };
        // Nos fijamos si los candidatos son mas de los que tenemos configurados
        // para mostrar en caso de que sea una PASO.
        var muchos_candidatos =
            constants.paso && candidatos.length > constants.colapsar_candidatos;

        if (!agrupacion && muchos_candidatos) {
            // Si tenemos muchos candidatos y no estamos ya mostrando una
            // agrupacion vamos a devolver las agrupaciones y cargar la pantalla
            // de agrupaciones para categoria.
            data_dict.partidos = this.businessData.get_agrupaciones_many({
                clase: constants.categoria_agrupa_por,
            });
            if (constants.asistida) {
                cargar_partidos_categoria_asistida(data_dict);
            } else {
                cargar_partidos_categoria(data_dict);
            }
        } else {
            // En caso de que esté mostrando un agrupacion y/o los candidatos sean
            // demasiados para mostrar.
            if (agrupacion) {
                // Voy a buscar todos los candidatos de este agrupacion.
                filter = {
                    clase: "Candidato",
                    cod_categoria: cod_categoria,
                };
                if (constants.categoria_agrupa_por == "Alianza") {
                    filter.cod_alianza = agrupacion;
                } else {
                    filter.cod_partido = agrupacion;
                }
                data_dict.candidatos =
                    this.businessData.get_candidaturas_many(filter);
                if (
                    data_dict.candidatos.length == 1 &&
                    constants.seleccionar_candidato_unico
                ) {
                    // Si esta agrupacion tiene un solo candidatos entonces lo
                    // seleccionamos, en algunas elecciones nos hacen cambiar este
                    // comportamiento para que el elector tenga que explicitamente
                    // hacer click en el candidato o en voto en blanco.
                    this.seleccion.seleccionar_candidatos(categoria, [
                        data_dict.candidatos[0].id_umv,
                    ]);
                    return;
                } else {
                    // Si tiene mas de un candidato para esta agrupacion entonces
                    // tenemos que traer el voto en blanco para mostrarlo.
                    filter = {
                        clase: "Blanco",
                        cod_categoria: cod_categoria,
                    };
                    blanco = this.businessData.get_candidaturas_one(filter);
                    // Si tenemos voto en blanco entonces lo agregamos.
                    if (blanco) {
                        data_dict.candidatos.push(blanco);
                    }
                }
            }

            // Ahora que sabemos que candidatos queremos mostrar cargamos los
            // candidatos en la pantalla.
            if (constants.asistida) {
                cargar_candidatos_asistida(data_dict);
            } else {
                cargar_candidatos(data_dict);
                if (agrupacion) {
                    var obj_agrupacion = this.businessData.get_agrupaciones_one(
                        {
                            codigo: agrupacion,
                        }
                    );
                    solapa(obj_agrupacion, categoria);
                }
            }
        }
    }
    
    /**
     * Indica si la navegacion viene de la pantalla de confirmacion
     */
    viene_de_confirmacion() {
        const seleccion = this.seleccion.get_seleccion();
        return localController.businessData
            .get_all_categorias()
            .every(c => seleccion[c.codigo] !== undefined);
    }

    /**
     * Carga los candidatos de las consultas popular.
     *
     * @param {*} categoria - Categoria que queremos mostrar.
     */
    _cargar_candidatos_consulta_popular(categoria) {
        // Traemos todas las opciones de la consulta_popular.
        var filter = {
            cod_categoria: categoria.codigo,
            clase: "Candidato",
        };

        var candidatos = this.businessData.get_candidaturas_many(filter);

        // Si hay voto en blanco en la consulta lo agregamos (en algunas consultas
        // puede no haber voto en blanco)
        filter.clase = "Blanco";
        var blanco = this.businessData.get_candidaturas_one(filter);
        if (blanco) {
            candidatos.push(blanco);
        }
        // Armamos el diccionario de datos.
        var data_dict = { candidatos: candidatos, categoria: categoria };
        // Y cargamos la pantalla.
        if (constants.asistida) {
            cargar_consulta_popular_asistida(data_dict);
        } else {
            cargar_consulta_popular(data_dict);
        }
    }

    /**
     * Carga la barra derecha de seleccion de categorías en caso de que se
     * tenga que mostrar efectivamente.
     */
    _cargar_datos_barra_categorias() {
        if (constants.mostrar_barra_seleccion) {
            // Traemos todas las categorias que queremos mostrar.
            var categorias = this.businessData.get_categorias_many({
                sorted: "posicion",
                consulta_popular: false,
                adhiere: null,
            });
            // Conctamos las categorias con los candidatos seleccionados para las
            // mismas.
            var candidatos_seleccionados = [];
            let _seleccion = this.seleccion.get_seleccion();
            for (var i in categorias) {
                var seleccion = _seleccion[categorias[i].codigo];
                var candidato = this.businessData.get_candidaturas_one({
                    id_umv: seleccion,
                });
                candidatos_seleccionados.push(candidato);
            }

            // Las cargamos en pantalla.
            cargar_categorias(categorias, candidatos_seleccionados);
        }
    }

    /**
     * Agrega o quita un candidato del array de preferencias
     * @param {*} max
     * @param {*} boton
     * @param {*} array
     * @param {*} codigo
     */
    toggle_array_candidato(max, boton, array, codigo) {
        if (
            constants.cambiar_rapido_seleccion &&
            max == 1 &&
            array.length == 1 &&
            (!array.includes(codigo) ||
            this.viene_de_confirmacion())
        ) {
            let candidatos = document.querySelectorAll(
                ".opcion-preferencia.seleccionado"
            );
            candidatos.forEach((candidato) => {
                candidato.classList.remove("seleccionado");
            });

            // No se puede usar array = []
            array.splice(0, array.length);
            array.push(codigo);

            boton.classList.add("seleccionado");
        } else if (array.includes(codigo)) {
            boton.classList.remove("seleccionado");
            var idx = array.indexOf(codigo);
            array.splice(idx, 1);
        } else if (array.length < max) {
            boton.classList.add("seleccionado");
            array.push(codigo);
        }
    }

    /** Carga la pantalla de confirmacion. */
    _cargar_confirmacion(seleccion) {
        // Flag que indica que se llegó a confirmación
        const local_data = this.businessData.get_local_data();
        local_data.llego_a_confirmacion = true;
        this.businessData.set_local_data(local_data);

        // Le decimos al backend cual es la seleccion del elector.
        this.seleccion.set_seleccion({ ...seleccion });
        let _seleccion = this.seleccion.get_seleccion();
        //al backend le paso solo id_umv
        var seleccion_id_umv = {};
        for (var cod_categoria in _seleccion) {
            if (cod_categoria !== "preferencias") {
                if (
                    typeof _seleccion.preferencias !== "undefined" &&
                    typeof _seleccion["preferencias"][cod_categoria] !==
                        "undefined" &&
                    _seleccion["preferencias"][cod_categoria].length > 0
                ) {
                    seleccion_id_umv[cod_categoria] =
                        _seleccion.preferencias[cod_categoria];
                } else {
                    seleccion_id_umv[cod_categoria] = _seleccion[cod_categoria];
                }
            }
        }
        send("seleccionar_candidatos", seleccion_id_umv);

        // Generamos los paneles de la pagina de confirmacion.
        const paneles_confirmacion =
            this.paneles_confirmacion_from_seleccion(seleccion);

        // Cargamos confirmacion segun el modulo en el que estamos.
        if (constants.asistida) {
            setTimeout(function () {
                mostrar_confirmacion_asistida(paneles_confirmacion);
            }, 1000);
        } else {
            mostrar_confirmacion(paneles_confirmacion);
        }
    }

    paneles_confirmacion_from_seleccion(seleccion) {
        const paneles_confirmacion = [];
        const filter_categorias = {};
        if (!constants.mostrar_adheridas_confirmacion) {
            filter_categorias.adhiere = null;
        }
        var categorias =
            this.businessData.get_categorias_many(filter_categorias);
        // Traemos los candidatos para todas las categorias.
        for (var i in categorias) {
            var categoria = categorias[i];
            var candidatos = seleccion[categoria.codigo];
            for (var j in candidatos) {
                var cod_candidato = candidatos[j];
                var filter_candidaturas = { id_umv: cod_candidato };
                var candidato =
                    this.businessData.get_candidaturas_one(filter_candidaturas);
                var params = { categoria: categoria, candidato: candidato };
                if (typeof categoria.max_preferencias !== "undefined") {
                    var preferencias = [];
                    var candidatos_pre =
                        seleccion["preferencias"][categoria.codigo];
                    for (var k in candidatos_pre) {
                        candidato = this.businessData.get_candidaturas_one({
                            id_umv: candidatos_pre[k],
                        });
                        preferencias.push(candidato);
                    }
                    params.preferencias = preferencias;
                }
                if (typeof categoria.max_tachas !== "undefined") {
                    var tachas = [];
                    var candidatos_tac = seleccion["tachas"];
                    for (var k in candidatos_tac) {
                        candidato = _crear_candidato_secundario(
                            candidato,
                            candidatos_pre[k]
                        );
                        tachas.push(candidato);
                    }
                    params.tachas = tachas;
                }
                paneles_confirmacion.push(params);
            }
        }
        return paneles_confirmacion;
    }

    cambio_valor_local_data(nameData, value) {
        this.businessData.cambio_valor_local_data(nameData, value);
    }

    /**
     * Decide cual es la proxima categoria vacia y la devuelve.
     *
     * @returns {any} - Devuelve la próxima categoría si la hay, caso contrario devuelve un booleano con valor de falso.
     */
    next_cat_vacia() {
        var filter = {
            sorted: "consulta_popular",
            adhiere: null,
        };
        const categorias = this.businessData.get_categorias_many(filter);
        let _seleccion = this.seleccion.get_seleccion();
        for (var i in categorias) {
            var cat = categorias[i];
            if (typeof _seleccion[cat.codigo] === "undefined") {
                return cat;
            }
        }
        return false;
    }
}
