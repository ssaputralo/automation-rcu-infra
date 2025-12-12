const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

let win;

const createWindow = () => {
    win = new BrowserWindow({
      width: 1200,
      height: 800,
      title: "Patch Report Checking Automation",
      frame: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    win.loadFile('index.html')
}

app.whenReady().then(() => createWindow())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC Handler Dummy (Hanya agar tidak error saat renderer memanggil)
ipcMain.handle('upload-files', async (event) => {
    return { ok: true };
});