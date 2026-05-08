// ARKI WhatsApp Co-Pilot - Background Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'close_tab' && sender.tab) {
        console.log("ARKI Co-Pilot: Closing tab ID", sender.tab.id);
        chrome.tabs.remove(sender.tab.id);
    }
});
