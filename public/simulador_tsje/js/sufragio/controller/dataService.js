/**
 * @namespace js.sufragio.localController.businessData.dataService
 */

/* 
    El archivo dataService.js contiene funciones que facilitan 
    la obtención y manipulación de datos locales relacionados 
    con la aplicación. Estas funciones pueden incluir consultas 
    a conjuntos de datos específicos, filtrado de información 
    y otras operaciones relacionadas con el servicio de datos.
*/

class DataService {
    constructor() {
        if (DataService.instance) {
            return DataService.instance;
        }
        this.local_data = {};
        DataService.instance = this;
    }

    _get_local_data() {
        return this.local_data;
    }

    _set_local_data(localData) {
        this.local_data = localData;
    }

    _get_boletas_first(filter) {
        return this.local_data.boletas.first(filter);
    }

    _get_boletas_one(filter) {
        return this.local_data.boletas.one(filter);
    }

    _get_boletas_many(filter) {
        return this.local_data.boletas.many(filter);
    }

    _get_all_boletas() {
        return this.local_data.boletas.all();
    }

    _get_candidaturas_first(filter) {
        return this.local_data.candidaturas.first(filter);
    }

    _get_candidaturas_one(filter) {
        return this.local_data.candidaturas.one(filter);
    }

    _get_candidaturas_many(filter) {
        return this.local_data.candidaturas.many(filter);
    }

    _get_all_candidaturas() {
        return this.local_data.candidaturas.all();
    }

    _get_agrupaciones_first(filter) {
        return this.local_data.agrupaciones.first(filter);
    }

    _get_agrupaciones_one(filter) {
        return this.local_data.agrupaciones.one(filter);
    }

    _get_agrupaciones_many(filter) {
        return this.local_data.agrupaciones.many(filter);
    }

    _get_all_agrupaciones() {
        return this.local_data.agrupaciones.all();
    }

    _get_categorias_first(filter) {
        return this.local_data.categorias.first(filter);
    }

    _get_categorias_one(filter) {
        return this.local_data.categorias.one(filter);
    }

    _get_categorias_many(filter) {
        return this.local_data.categorias.many(filter);
    }

    _get_all_categorias() {
        return this.local_data.categorias.all();
    }

    codigos_cargos() {
        return this.local_data.categorias._data.map((c) => c.codigo);
    }
}
