const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('fs').promises
const path = require('path')

let win; // Variabel global agar bisa diakses handler window control

const createWindow = () => {
    // Membuat jendela browser
    win = new BrowserWindow({
      width: 1000, // Sedikit diperlebar agar layout Bootstrap lega
      height: 700,
      title: "Patch Report Checking Automation",
      frame: false, // Frameless agar terlihat modern
      // Gunakan preload + contextIsolation untuk keamanan
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    })
  
    // Memuat file tampilan
    win.loadFile('index.html')
}

// Menjalankan fungsi saat aplikasi siap
app.whenReady().then(() => {
  createWindow()
})

// Keluar aplikasi saat semua jendela ditutup (Windows/Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers: Menangani dialog buka file
ipcMain.handle('open-dialog', async (event, options = {}) => {
  try {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), Object.assign({ properties: ['openFile'] }, options));
    return { canceled: result.canceled, filePaths: result.filePaths };
  } catch (err) {
    return { error: err.message };
  }
});

// IPC handlers: Menangani penyimpanan file
ipcMain.handle('save-file', async (event, { filePath, data, defaultPath } = {}) => {
  try {
    let target = filePath;
    const lastArg = arguments[1] || {};
    const autoSave = lastArg.autoSave === true;

    if (!target) {
      if (autoSave) {
        const uploadsDir = path.join(app.getPath('userData'), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        target = path.join(uploadsDir, defaultPath || 'untitled.bin');
      } else {
        const { canceled, filePath: chosen } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), { defaultPath: defaultPath || 'untitled.txt' });
        if (canceled) return { ok: false, canceled: true };
        target = chosen;
      }
    }

    if (!target) return { ok: false, error: 'No file path specified' };

    let toWrite;
    if (data == null) {
      toWrite = '';
    } else if (Buffer.isBuffer(data)) {
      toWrite = data;
    } else if (data instanceof ArrayBuffer) {
      toWrite = Buffer.from(new Uint8Array(data));
    } else if (data && data.buffer && data.buffer instanceof ArrayBuffer) {
      toWrite = Buffer.from(new Uint8Array(data.buffer));
    } else if (typeof data === 'string') {
      toWrite = data;
    } else {
      toWrite = JSON.stringify(data);
    }

    await fs.writeFile(target, toWrite);

    try { event.sender.send('file-saved', { path: target }); } catch (e) { /* ignore send errors */ }
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Event listener sederhana dari renderer
ipcMain.on('file-selected', (event, info) => {
  console.log('Renderer reported selected file:', info);
});

// --- PERBAIKAN PENTING: HANDLER UPLOAD (OFFLINE MODE) ---
// Bagian ini dimodifikasi agar tidak mengirim request HTTP ke server luar.
// Melainkan langsung menerima data di memori agar aplikasi desktop bisa lanjut proses.
ipcMain.handle('upload-files', async (event, { files }) => {
  try {
    // 1. Log nama file untuk memastikan data sampai di Main Process
    console.log('Main Process menerima file:', files.map(f => f.name));

    // 2. Di sini nanti Anda bisa menambahkan logika pengolahan data
    // (Misalnya: membaca Excel dengan library 'xlsx' atau PPT dengan 'pptxgenjs')
    
    // 3. Langsung kembalikan SUKSES agar UI berpindah ke halaman Overview
    return { ok: true };

  } catch (err) {
    console.error('Error handling files:', err);
    return { ok: false, error: err.message };
  }
});

// Window control handlers (Minimize/Maximize/Close)
ipcMain.handle('window-minimize', () => {
  try { if (win) win.minimize(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('window-close', () => {
  try { if (win) win.close(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('window-toggle-maximize', () => {
  try {
    if (!win) return { ok: false, error: 'No window' };
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
    return { ok: true, isMaximized: win.isMaximized() };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('window-is-maximized', () => {
  try { return { ok: true, isMaximized: win ? win.isMaximized() : false }; } catch (e) { return { ok: false, error: e.message }; }
});