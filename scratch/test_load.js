// Diagnostic script to check for runtime syntax and execution errors in Node
const fs = require('fs');
const path = require('path');

// Mock localStorage
const mockStorage = {};
const localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Mock browser globals
global.window = global;
global.document = {
  addEventListener: (event, callback) => {
    if (event === 'DOMContentLoaded') {
      global.domContentLoadedCallback = callback;
    }
  },
  getElementById: (id) => {
    return {
      addEventListener: () => {},
      innerText: '',
      innerHTML: '',
      value: '',
      dataset: {},
      appendChild: () => {},
      querySelector: () => ({ addEventListener: () => {} }),
      querySelectorAll: () => []
    };
  },
  querySelectorAll: () => [],
  createElement: () => ({
    className: '',
    innerHTML: '',
    addEventListener: () => {}
  })
};
global.localStorage = localStorage;

// Mock external library objects
global.Chart = class {};
global.XLSX = {};
global.jspdf = { jsPDF: class {} };

// Helper to load file
function loadScript(filename) {
  const filePath = path.join(__dirname, '..', filename);
  console.log(`Loading ${filename}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  eval(content);
}

try {
  loadScript('js/sat_codes.js');
  loadScript('js/mock_data.js');
  loadScript('js/accounting.js');
  loadScript('js/app.js');
  
  console.log("All scripts evaluated successfully without syntax errors.");
  
  if (global.domContentLoadedCallback) {
    console.log("Running DOMContentLoaded callback...");
    global.domContentLoadedCallback();
    console.log("DOMContentLoaded callback executed successfully.");
  } else {
    console.log("WARNING: DOMContentLoaded callback not registered.");
  }
} catch (e) {
  console.error("ERROR running scripts:", e);
}
