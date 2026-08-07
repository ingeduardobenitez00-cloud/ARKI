/* sufragio/local_controller.js */
/* global es_candidato_con_preferentes */
/* global candidatura_es_de_preferente_unico */


/**
 * dependencias externas: 
 * - es_candidato_con_preferentes ()
 */


/**
 * 
 * @memberof js.sufragio.extension
 */
class TemplateChipa extends Templates {
    /**
     * Devuelve el nombre del template para un candidato
     *
     * @override
     * @param {*} candidato - El candidato a crearle el botón.
     * @returns {String} Nombre del template que usa el candidato
     */
    __get_template_name_candidato(candidato, candidatos) {
        if (this.__es_candidato_blanco(candidato)) return "candidato_blanco";
        if (this.__es_candidato_con_secundarios(candidato))
            return "candidato_con_secundarios";
        if (this.__es_candidato_con_vicepresidente(candidato))
            return "candidato_pre_vice_con_imagen";
        if (es_lista_con_imagen(candidatos))
            return "candidato_lista_con_imagen";
        return "candidato_lista_sin_imagen";

        function es_lista_con_imagen(candidatos) {
            const no_tiene_preferentes = candidatos.every(
                (c) =>
                    !localController.businessData.es_candidato_con_preferentes(
                        c
                    )
            );
            const es_preferente_unico = candidatos.every((candidato) =>
                localController.businessData.candidatura_es_de_preferente_unico(
                    candidato
                )
            );
            return no_tiene_preferentes || es_preferente_unico;
        }
    }

    /**
     * Devuelve los datos que necesita el template de candidato
     *
     * @override
     * @param {*} candidato - El candidato a crearle el botón.
     * @param {*} seleccionado - Si el candidato está seleccionado o no.
     * @returns {*}
     */
    __get_template_data_candidato(candidato, seleccionado) {
        let template_data = super.__get_template_data_candidato(
            candidato,
            seleccionado
        );

        if ("cargos_cerrados_abiertos" in constants) {
            const es_candidato_pvm =
                !template_data.blanco &&
                constants.cargos_cerrados_abiertos.includes(
                    candidato.cod_categoria
                );

            template_data.es_pvm = es_candidato_pvm;
            if (es_candidato_pvm)
                template_data = inyectar_data_pvm(template_data);
        }
        if ("cargos_con_vice1_y_vice2" in constants) {
            const es_candidato_pvp =
                !template_data.blanco &&
                constants.cargos_con_vice1_y_vice2.includes(
                    candidato.cod_categoria
                );

            template_data.es_pvp = es_candidato_pvp;
            if (es_candidato_pvp)
                template_data = inyectar_data_pvp(template_data);
        }
        if ("cargos_con_vicepresidente" in constants) {
            const es_candidato_pv =
                !template_data.blanco &&
                constants.cargos_con_vicepresidente.includes(
                    candidato.cod_categoria
                );

            template_data.es_pv = es_candidato_pv;
            if (template_data.es_pv)
                template_data = inyectar_data_pv(
                    template_data,
                    constants.cargos_con_vicepresidente_mujeres.includes(
                        candidato.cod_categoria
                    )
                );
        }
        template_data.mostrar_color =
            "mostrar_color" in constants ? constants.mostrar_color : false;
        return template_data;

        function inyectar_data_pvm(template_data) {
            const cargos = ["Presidente", "Vice Pdte. 1°", "Vice Pdte. 2°"];
            template_data.candidato.lista.datos_extra = {
                ...template_data.candidato.lista.datos_extra,
                cargos: cargos_data(
                    quitarCargosKey(template_data.candidato.lista.datos_extra)
                ),
            };
            return template_data;

            function cargos_data(datos_extra) {
                return [
                    datos_extra.presidente,
                    datos_extra.vice_1,
                    datos_extra.vice_2,
                ].map((candidato, idx) => ({
                    nombre: cargos[idx],
                    candidato,
                }));
            }

            function quitarCargosKey(datos_extra) {
                const { cargos, ...sinCargosKey } = datos_extra;
                return sinCargosKey;
            }
        }

        function inyectar_data_pvp(template_data) {
            const cargos = ["Presidente", "Vice Pdte. 1°", "Vice Pdte. 2°"];
            const candidatos = [
                template_data.candidato.nombre,
                template_data.candidato.secundarios[0],
                template_data.candidato.secundarios[1],
            ];
            template_data.candidato.lista.datos_extra = {
                cargos: cargos_data(cargos, candidatos),
            };
            return template_data;

            function cargos_data(cargos, candidatos) {
                return cargos.map((cargo, idx) => ({
                    nombre: cargo,
                    candidato: candidatos[idx],
                }));
            }
        }

        function inyectar_data_pv(template_data, es_de_mujeres) {
            let cargos = ["Presidente", "Vicepresidente"];
            if (es_de_mujeres) {
                cargos = ["Presidenta", "Vicepresidenta"];
            }
            const candidatos = [
                template_data.candidato.nombre,
                template_data.candidato.secundarios[0],
            ];
            template_data.candidato.lista.datos_extra = {
                cargos: cargos_data(cargos, candidatos),
            };
            return template_data;

            function cargos_data(cargos, candidatos) {
                return cargos.map((cargo, idx) => ({
                    nombre: cargo,
                    candidato: candidatos[idx],
                }));
            }
        }
    }

    /**
     * Devuelve el nombre del template de la tarjeta de confirmacion
     *
     * @override
     * @param {*} candidato - El candidato a crearle el botón.
     * @param {*} categoria - La categoria a crearle el botón.
     * @returns {String} Nombre del template que se usa en la confirmacion
     */
    __get_template_name_confirmacion(candidato, categoria) {
        var self = this;
        //registra partial que usa el template de confirmacion confirmacion_tarjeta
        let partials_name = template_name_componente_confirmacion(candidato);
        Handlebars.registerPartial(
            "componenteConfirmacion",
            get_template_desde_cache(partials_name)
        );
        return "confirmacion_tarjeta";

        function template_name_componente_confirmacion(candidato) {
            if (candidato.blanco || candidato.clase === "Blanco")
                return "confirmacion_candidato_blanco";

            const tiene_secundarios = self.__es_cargo_con_secundarios(
                candidato.cod_categoria
            );
            const tiene_pre_vice =
                self.__es_candidato_con_vicepresidente(candidato);
            const tiene_preferentes =
                localController.businessData.es_candidato_con_preferentes(
                    candidato
                );

            if (tiene_pre_vice) return "confirmacion_pre_vice";
            if (tiene_secundarios && tiene_preferentes)
                return "confirmacion_con_secundarios_y_preferentes";
            if (tiene_secundarios) return "confirmacion_con_secundarios";
            if (tiene_preferentes) return "confirmacion_con_preferentes";
            return "confirmacion";
        }
    }

    /**
     * Devuelve los datos que necesita el template de la tarjeta de confirmacion
     *
     * @override
     * @param {*} candidato - El candidato a crearle el botón.
     * @param {*} categoria - La categoria a crearle el botón.
     * @param {number} cantidad_categorias - Total de categorias a mostrar
     * @returns {*}
     */
    __get_template_data_confirmacion(
        candidato,
        categoria,
        cantidad_categorias
    ) {
        let vice1 = candidato.secundarios[0];
        let vice2 = candidato.secundarios[1];

        var nombre_partido = "";
        if (candidato.partido !== null && candidato.partido !== undefined) {
            nombre_partido = candidato.partido.nombre;
        }

        var id_confirmacion = "confirmacion_" + categoria.codigo;
        var template_data = this.main_dict_candidato(
            candidato,
            id_confirmacion,
            "confirmacion"
        );
        template_data.boton_confirmar_claro = false;
        template_data.modificar = true;

        if (template_data.candidato.lista != undefined) {
            if (template_data.candidato.lista.color_tipografia[0] == "#ffffff")
                template_data.boton_confirmar_claro = true;
        }

        if (
            cantidad_categorias == 1 &&
            !constants.boton_modificar_con_una_categoria
        ) {
            template_data.modificar = false;
        }
        template_data.consulta_popular = categoria.consulta_popular
            ? "consulta_popular"
            : "";
        template_data.categoria = categoria;
        template_data.nombre_partido = template_data.blanco
            ? ""
            : nombre_partido;
        template_data.vice1 = vice1;
        template_data.vice2 = vice2;

        if (this.__es_candidato_con_vicepresidente(candidato)) {
            template_data.nombre_cargo_presidente = "Presidente";
            template_data.nombre_cargo_vicepresidente = "Vicepresidente";
            if (
                constants.cargos_con_vicepresidente_mujeres.includes(
                    candidato.cod_categoria
                )
            ) {
                template_data.nombre_cargo_presidente = "Presidenta";
                template_data.nombre_cargo_vicepresidente = "Vicepresidenta";
            }
            template_data.nombre_cargo_vicepresidente  = (typeof vice2 !== "undefined" ? "Vice 1°" : template_data.nombre_cargo_vicepresidente);
            template_data.nombre_cargo_vicepresidente2 = (typeof vice2 !== "undefined" ? "Vice 2°" : null);
        }
        template_data.mostrar_color =
            "mostrar_color" in constants ? constants.mostrar_color : false;
        return template_data;
    }

    /**
     * Indica si es candidato blanco
     *
     * @param {*} candidato - El candidato sobre el que se consulta si es blanco.
     * @returns {Boolean}
     */
    __es_candidato_blanco(candidato) {
        return candidato.blanco;
    }

    /**
     * Indica si es cargo con secundarios
     *
     * @param {number} cod_categoria - Codigo de la categoria sobre la que se quiere consultar
     * @returns {Boolean}
     */
    __es_cargo_con_secundarios(cod_categoria) {
        if (
            !("cargos_con_secundarios" in constants) ||
            constants.cargos_con_secundarios === null
        )
            return true;
        return constants.cargos_con_secundarios.includes(cod_categoria);
    }

    /**
     * Indica si el cargo del candidato es con secundarios
     *
     * @param {*} candidato - El candidato sobre el que se consulta si tiene cargo con secundarios
     * @returns {Boolean}
     */
    __es_candidato_con_secundarios(candidato) {
        return this.__es_cargo_con_secundarios(candidato.cod_categoria);
    }

    /**
     * Indica si el cargo del candidato es con vicepresidente
     *
     * @param {*} candidato - El candidato sobre el que se consulta si tiene cargo con vicepresidente
     * @returns {Boolean}
     */
    __es_candidato_con_vicepresidente(candidato) {
        if (!("cargos_con_vicepresidente" in constants)) return false;
        return constants.cargos_con_vicepresidente.includes(
            candidato.cod_categoria
        ) || constants.cargos_con_vice1_y_vice2.includes(candidato.cod_categoria);
    }

    /**
     * Genera un candidato para la tarjeta de verificación.
     *
     * @param {*} datos_candidato - Datos necesarios para crear el candidato.
     * @returns {*}
     */
    __crear_candidato_verificacion(datos_candidato) {
        let candidato;
        if (datos_candidato.constructor === Array) {
            let candidato_principal = localController.businessData.get_candidaturas_one({
                id_umv: datos_candidato[0],
            });
            let id_candidatura_secundario = datos_candidato[1];

            if (
                id_candidatura_secundario != null &&
                id_candidatura_secundario != candidato_principal.id_candidatura
            ) {
                candidato = buscar_secundario(
                    candidato_principal,
                    datos_candidato[1]
                );
                candidato.cod_categoria = candidato_principal.cod_categoria;
                candidato.lista = candidato_principal.lista;
                candidato.imagenes = [];
                candidato.imagenes[0] = candidato.imagen;
            } else {
                candidato = candidato_principal;
            }
        } else {
            candidato = localController.businessData.get_candidaturas_one({
                id_umv: datos_candidato,
            });
        }
        if (
            localController.businessData.get_categorias_many().length <=
            constants.max_imagen_izquierda
        )
            candidato.clase_less = "_imagen_izquierda";
        return candidato;
    }

    /**
     * Crea el contenido del boton de verificacion.
     *
     * @param {*} candidato - El candidato a crearle el botón.
     * @param {*} template - Template de verificacion (Handlebars).
     * @returns {String} Html en formato de cadena de caracteres.
     */
    __crear_item_verificacion(candidato, categoria, template) {
        var self = this;
        //el template de verificacion usa un partial que debemos registrar previo a devolverlo
        Handlebars.registerPartial(
            "componenteVerificacion",
            get_template_desde_cache(
                template_name_componente_verificacion(candidato, categoria)
            )
        );
        return super.__crear_item_verificacion(candidato, categoria, template);

        function template_name_componente_verificacion(candidato, categoria) {
            if (candidato.blanco || candidato.clase === "Blanco")
                return "verificacion_candidato_blanco";
            const tiene_secundarios = self.__es_cargo_con_secundarios(
                candidato.cod_categoria
            );
            const tiene_preferentes =
                localController.businessData.es_candidato_con_preferentes(
                    candidato
                );
            const pre_vice = constants.cargos_con_vicepresidente.includes(
                categoria.codigo
            );
            const pre_vice1_y_vice2 = constants.cargos_con_vice1_y_vice2.includes(
                categoria.codigo
            );            
            const cant_categorias_con_seleccion = 
                localController.businessData.get_categorias_many().length;
            if (tiene_secundarios && tiene_preferentes)
                return "verificacion_con_secundarios_y_preferentes";
            if (tiene_secundarios) return "verificacion_con_secundarios";
            if (tiene_preferentes) return (cant_categorias_con_seleccion === 2)
                ? "verificacion_con_preferentes_img_izquierda"
                : "verificacion_con_preferentes"
            if (pre_vice) return "verificacion_pre_vice";
            if (pre_vice1_y_vice2) return "verificacion_pre_vice";
            return (cant_categorias_con_seleccion === 2)
                ? "verificacion_cerrada_img_izquierda"
                : "verificacion_cerrada";
        }
    }

    /**
     * Devuelve el nombre del template de la tarjeta de confirmacion
     *
     * @returns {String} Nombre del template que se usa en la confirmacion
     */
    __get_template_name_verificacion() {
        return "verificacion_tarjeta";
    }

    /**
     * Devuelve los datos que necesita el template de la tarjeta de confirmacion
     *
     * @param {*} candidato - datos del candidato a crearle el panel de verificación.
     * @param {*} categoria - La categoria a crearle el botón.
     * @returns {*}
     */
    __get_template_data_verificacion(candidato, categoria) {
        let template_data = super.__get_template_data_verificacion(
            candidato,
            categoria
        );

        //si el template no esta definido buscamos el anterior
        if (
            !this.__constants.numeros_templates_verificacion.includes(
                template_data.cant_cargos
            )
        ) {
            template_data.cant_cargos =
                constants.numeros_templates_verificacion.reduce(function (
                    prev,
                    curr
                ) {
                    return Math.abs(curr - template_data.cant_cargos) <
                        Math.abs(prev - template_data.cant_cargos)
                        ? curr
                        : prev;
                });
        }

        if (
            this.__es_cargo_con_secundarios(candidato.cod_categoria) &&
            !template_data.blanco
        ) {
            template_data.cat_cerrada_abierta = false;
            if (candidato.cod_categoria !== "PVC") {
                template_data.presidente = template_data.candidato.nombre;
                template_data.vice_1 = template_data.candidato.secundarios[0];
                template_data.vice_2 = template_data.candidato.secundarios[1];
            } else {
                template_data.cat_cerrada_abierta = true;
                template_data.presidente =
                    template_data.candidato.lista.datos_extra.presidente;
                template_data.vice_1 =
                    template_data.candidato.lista.datos_extra.vice_1;
                template_data.vice_2 =
                    template_data.candidato.lista.datos_extra.vice_2;
            }
        }
        template_data.mostrar_color =
            "mostrar_color" in constants ? constants.mostrar_color : false;
        return template_data;
    }
}

templateClass = new TemplateChipa(get_modo(), constants);
