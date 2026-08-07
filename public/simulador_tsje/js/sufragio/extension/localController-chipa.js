class DataServiceChipa extends DataService {
    constructor() {
        super();
    }
}

class BusinessDataChipa extends BusinessData {
    constructor(dataService) {
        super();
        this.dataService = dataService;
    }
}

class SeleccionChipa extends Seleccion {
    constructor() {
        super();
    }
}

class LocalControllerChipa extends LocalController {
    constructor(businessData, seleccion) {
        super();
        this.businessData = businessData;
        this.seleccion = seleccion;
    }
}

const dataServiceChipa = new DataServiceChipa();
const businessDataChipa = new BusinessDataChipa(dataServiceChipa);
const seleccionChipa = new SeleccionChipa();
localController = new LocalControllerChipa(businessDataChipa, seleccionChipa);
