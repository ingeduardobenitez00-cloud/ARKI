// ARKI WhatsApp Co-Pilot - Content Script
console.log("🔴 [ARKI Co-Pilot] Content script cargado con éxito.");

// Buscar parámetros específicos en la URL
const params = new URLSearchParams(window.location.search);
const isAutoSend = params.get('arki_auto_send') === 'true';
const flyerUrl = params.get('arki_flyer_url');
const textMessage = params.get('text');

if (isAutoSend) {
    console.log("🔴 [ARKI Co-Pilot] Automatización activa para este chat!");
    createStatusOverlay("Iniciando automatización...");
    startAutomation();
}

// Crear una superposición visual elegante en WhatsApp Web
function createStatusOverlay(statusText) {
    let overlay = document.getElementById('arki-co-pilot-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'arki-co-pilot-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '15px';
        overlay.style.right = '15px';
        overlay.style.zIndex = '999999';
        overlay.style.backgroundColor = '#0f172a';
        overlay.style.color = '#f8fafc';
        overlay.style.border = '2px solid #3b82f6';
        overlay.style.borderRadius = '16px';
        overlay.style.padding = '12px 20px';
        overlay.style.fontFamily = 'system-ui, sans-serif';
        overlay.style.fontSize = '12px';
        overlay.style.fontWeight = 'bold';
        overlay.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.gap = '10px';
        overlay.style.transition = 'all 0.3s ease';

        // Agregar un spinner giratorio
        const spinner = document.createElement('div');
        spinner.style.width = '14px';
        spinner.style.height = '14px';
        spinner.style.border = '2px solid #3b82f6';
        spinner.style.borderTop = '2px solid transparent';
        spinner.style.borderRadius = '50%';
        spinner.style.animation = 'arki-spin 1s linear infinite';
        overlay.appendChild(spinner);

        // Agregar estilos CSS para la animación
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes arki-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        const label = document.createElement('span');
        label.id = 'arki-co-pilot-text';
        label.innerText = statusText;
        overlay.appendChild(label);

        document.body.appendChild(overlay);
    } else {
        const label = document.getElementById('arki-co-pilot-text');
        if (label) label.innerText = statusText;
    }
}

// Función de espera utilitaria
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función para esperar un elemento del DOM de forma robusta
async function waitForSelector(selector, timeout = 40000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await delay(500);
    }
    throw new Error(`Timeout esperando el selector: ${selector}`);
}

async function startAutomation() {
    try {
        createStatusOverlay("Esperando que cargue el chat...");
        
        // Esperar el input de texto editable principal de WhatsApp Web
        const chatInputSelector = 'div[contenteditable="true"][role="textbox"]';
        const chatInput = await waitForSelector(chatInputSelector);
        
        console.log("🔴 [ARKI Co-Pilot] Chat cargado correctamente.");
        await delay(1500); // Dar un margen para que React se inicialice

        if (flyerUrl) {
            createStatusOverlay("Descargando imagen...");
            console.log("🔴 [ARKI Co-Pilot] Descargando imagen desde:", flyerUrl);
            
            // Descargar la imagen
            const response = await fetch(flyerUrl);
            const blob = await response.blob();
            const file = new File([blob], 'arki_campaña.jpg', { type: blob.type });

            createStatusOverlay("Pegando imagen en WhatsApp...");
            console.log("🔴 [ARKI Co-Pilot] Pegando imagen en el chat...");

            // Simular el evento pegar (Clipboard paste) en el input principal
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });

            chatInput.focus();
            chatInput.dispatchEvent(pasteEvent);

            createStatusOverlay("Esperando panel de vista previa...");
            // Esperar a que se abra la ventana de vista previa de la foto
            // En la vista previa el boton de enviar tiene un data-icon="send"
            const previewSendBtnSelector = '[data-icon="send"], span[data-icon="send"], button[aria-label="Enviar"]';
            const sendBtn = await waitForSelector(previewSendBtnSelector);
            
            await delay(1000);

            // Escribir el texto como comentario de la imagen
            if (textMessage) {
                createStatusOverlay("Escribiendo mensaje...");
                console.log("🔴 [ARKI Co-Pilot] Escribiendo el texto del flyer...");
                
                // Buscar el input de comentario (es el div editable activo o el de caption)
                const captionInput = document.querySelector('div[contenteditable="true"][data-placeholder*="comentario"]') ||
                                     document.querySelector('div[contenteditable="true"][data-placeholder*="caption"]') ||
                                     document.activeElement;
                
                if (captionInput) {
                    captionInput.focus();
                    document.execCommand('insertText', false, textMessage);
                    await delay(1000);
                }
            }

            createStatusOverlay("Enviando mensaje...");
            console.log("🔴 [ARKI Co-Pilot] Haciendo click en Enviar...");
            sendBtn.click();

        } else {
            // Envío de solo texto (sin foto)
            createStatusOverlay("Buscando botón de enviar...");
            console.log("🔴 [ARKI Co-Pilot] Mensaje de solo texto, buscando botón de enviar...");
            
            // El texto ya fue pre-cargado nativamente por WhatsApp desde el parámetro 'text'
            await delay(1000);
            
            const sendBtnSelector = 'span[data-icon="send"], button[aria-label="Enviar"]';
            const sendBtn = await waitForSelector(sendBtnSelector);
            
            createStatusOverlay("Enviando mensaje...");
            sendBtn.click();
        }

        // Esperar a que se complete el envío de red y cerrar
        createStatusOverlay("Mensaje enviado! Cerrando pestaña...");
        await delay(3000);
        
        chrome.runtime.sendMessage({ action: 'close_tab' });

    } catch (err) {
        console.error("❌ [ARKI Co-Pilot] Error durante la automatización:", err.message);
        createStatusOverlay(`Error: ${err.message}`);
        
        let overlay = document.getElementById('arki-co-pilot-overlay');
        if (overlay) {
            overlay.style.borderColor = '#ef4444';
            overlay.style.backgroundColor = '#7f1d1d';
        }
    }
}
