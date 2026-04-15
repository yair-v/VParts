const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  initDatabase,
  saveCatalog,
  listCatalogs,
  getCatalog,
  deleteCatalog,
  saveOrder,
  listOrders,
  getOrder,
  deleteOrder
} = require('./db/database');

let mainWindow;

function ensureAppFolders() {
  const docsDir = path.join(app.getPath('userData'), 'documents');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  return { docsDir };
}

function createWindow() {
  ensureAppFolders();
  initDatabase(app.getPath('userData'));

  mainWindow = new BrowserWindow({
    width: 1680,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    backgroundColor: '#0a0f18',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:save-text', async (_event, { defaultName, text }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save text export',
    defaultPath: defaultName,
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, text, 'utf8');
  return { canceled: false, filePath };
});

ipcMain.handle('document:store', async (_event, { fileName, buffer }) => {
  const { docsDir } = ensureAppFolders();
  const safeName = `${Date.now()}-${String(fileName || 'document').replace(/[^\w.\-]+/g, '_')}`;
  const fullPath = path.join(docsDir, safeName);
  fs.writeFileSync(fullPath, Buffer.from(buffer));
  return { path: fullPath, name: fileName };
});

ipcMain.handle('document:read', async (_event, { filePath }) => {
  if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: 'FILE_NOT_FOUND' };
  const buffer = fs.readFileSync(filePath);
  return {
    ok: true,
    buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  };
});

ipcMain.handle('catalogs:save', async (_event, payload) => saveCatalog(payload));
ipcMain.handle('catalogs:list', async () => listCatalogs());
ipcMain.handle('catalogs:get', async (_event, id) => getCatalog(id));
ipcMain.handle('catalogs:delete', async (_event, id) => deleteCatalog(id));

ipcMain.handle('orders:save', async (_event, payload) => saveOrder(payload));
ipcMain.handle('orders:list', async () => listOrders());
ipcMain.handle('orders:get', async (_event, id) => getOrder(id));
ipcMain.handle('orders:delete', async (_event, id) => deleteOrder(id));
