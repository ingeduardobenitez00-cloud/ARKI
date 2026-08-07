// 1. Ocultar los logos de la cabecera
const style = document.createElement('style');
style.textContent = `
    #logo_eleccion, #logo_votar { display: none !important; }
    .opcion-difuminada { 
        opacity: 0.15 !important; 
        filter: blur(2px) !important; 
        /* pointer-events: none !important; */
    }
`;
document.head.appendChild(style);

// 2. Difuminar todo excepto Lista 1 y Opcion 5
const observer = new MutationObserver(() => {
    document.querySelectorAll('.candidato, .boton-lista').forEach(el => {
        if (el.dataset.procesado) return;
        el.dataset.procesado = "true";
        
        const texto = el.innerText.toUpperCase();
        let mantenerVisible = false;
        
        // Usamos regex para asegurar que sea exactamente "LISTA 1" y no "LISTA 10", contemplando saltos de linea
        if (/\bLISTA\s+1\b/.test(texto) && !/\bLISTA\s+10\b/.test(texto) && !/\bLISTA\s+1[1-9]\b/.test(texto) && !/\bLISTA\s+21\b/.test(texto) && !/\bLISTA\s+300\b/.test(texto)) {
            mantenerVisible = true;
        }
        if (/\bOPCI[OÓ]N\s+5\b/.test(texto)) {
            mantenerVisible = true;
        }
        
        if (!mantenerVisible) {
            el.classList.add('opcion-difuminada');
        }
    });
});

// Observar todo el body por si cambian de pantalla
window.addEventListener('load', () => {
    observer.observe(document.body, { childList: true, subtree: true });
});

// 3. Mostrar splash2.png al hacer clic en Imprimir Seleccion
document.addEventListener('click', (e) => {
    let el = e.target.closest('.opcion-tipo-voto, div.boton-accion, div[id*="confirmar"]');
    if (!el && e.target.closest('div')) el = e.target.closest('div');
    
    if (el && el.innerText && el.innerText.toUpperCase().includes('IMPRIMIR')) {
        if (document.getElementById('splash2')) return;
        
        let splash = document.createElement('div');
        splash.id = 'splash2';
        splash.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #ffffff; z-index: 999999; display: flex; justify-content: center; align-items: center; transition: opacity 0.5s ease-out;';
        splash.innerHTML = '<img src="splash2.png" style="max-width: 80%; max-height: 80%;" alt="Imprimiendo..." />';
        document.body.appendChild(splash);
        
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => {
                if(splash.parentNode) splash.parentNode.removeChild(splash);
                // Volver al inicio recargando el simulador (el iframe)
                window.location.reload();
            }, 500);
        }, 2000);
    }
}, true); // Usar capture para reaccionar de inmediato al clic
