
async function listModels() {
    const API_KEY = 'AIzaSyCIo1p0fcPi2ybkDVJ6Bbha0WOqMk_3AxI';
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
listModels();
