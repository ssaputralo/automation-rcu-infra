const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Send a small message to main (e.g., file info)
  sendFileSelected: (info) => ipcRenderer.send('file-selected', info),

  // Invoke a handler in main and await result
  invoke: (channel, data) => {
    // whitelist allowed channels
    const allowed = ['save-file', 'open-dialog', 'upload-files'];
    if (allowed.includes(channel)) return ipcRenderer.invoke(channel, data);
    return Promise.reject(new Error('Channel not allowed'));
  },

  // Listen for events from main
  on: (channel, callback) => {
    const allowed = ['save-result', 'file-saved'];
    if (!allowed.includes(channel)) return;
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});
