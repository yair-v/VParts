const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vparts', {
  saveTextExport: (payload) => ipcRenderer.invoke('dialog:save-text', payload),
  storeDocument: (payload) => ipcRenderer.invoke('document:store', payload),
  readDocument: (payload) => ipcRenderer.invoke('document:read', payload),

  saveCatalog: (payload) => ipcRenderer.invoke('catalogs:save', payload),
  listCatalogs: () => ipcRenderer.invoke('catalogs:list'),
  getCatalog: (id) => ipcRenderer.invoke('catalogs:get', id),
  deleteCatalog: (id) => ipcRenderer.invoke('catalogs:delete', id),

  saveOrder: (payload) => ipcRenderer.invoke('orders:save', payload),
  listOrders: () => ipcRenderer.invoke('orders:list'),
  getOrder: (id) => ipcRenderer.invoke('orders:get', id),
  deleteOrder: (id) => ipcRenderer.invoke('orders:delete', id)
});
