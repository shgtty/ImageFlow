const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('public/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });

dom.window.fetch = async (url) => {
    return {
        ok: true,
        json: async () => JSON.parse(fs.readFileSync('test_api.json', 'utf8'))
    };
};
dom.window.localStorage = {
    getItem: (key) => null,
    setItem: (key, val) => {},
    removeItem: (key) => {}
};

// Add all the scripts to JSDOM
const utilsCode = fs.readFileSync('public/js/utils.js', 'utf8');
const galleryCode = fs.readFileSync('public/js/gallery-view.js', 'utf8');
const dualCode = fs.readFileSync('public/js/dual-view.js', 'utf8');
const mainCode = fs.readFileSync('public/js/script.js', 'utf8');

const scriptEl1 = dom.window.document.createElement('script');
scriptEl1.textContent = utilsCode;
dom.window.document.body.appendChild(scriptEl1);

const scriptEl2 = dom.window.document.createElement('script');
scriptEl2.textContent = galleryCode;
dom.window.document.body.appendChild(scriptEl2);

const scriptEl3 = dom.window.document.createElement('script');
scriptEl3.textContent = dualCode;
dom.window.document.body.appendChild(scriptEl3);

const scriptEl4 = dom.window.document.createElement('script');
scriptEl4.textContent = mainCode;
dom.window.document.body.appendChild(scriptEl4);

setTimeout(() => {
    console.log("Scripts loaded.");
    const event = new dom.window.KeyboardEvent('keydown', { key: 'PageDown' });
    dom.window.document.dispatchEvent(event);
    console.log("PageDown dispatched.");
}, 1000);
