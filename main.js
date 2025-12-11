const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('fs').promises
const path = require('path')

const createWindow = () => {
    // Membuat jendela browser
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      title: "Patch Report Checking Automation",
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

// IPC handlers: allow renderer to ask main process to save files or open dialogs
ipcMain.handle('open-dialog', async (event, options = {}) => {
  // options can include properties for showOpenDialog or showSaveDialog
  try {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), Object.assign({ properties: ['openFile'] }, options));
    return { canceled: result.canceled, filePaths: result.filePaths };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('save-file', async (event, { filePath, data, defaultPath } = {}) => {
  try {
    let target = filePath;
    // allow auto-save to default uploads folder by passing autoSave flag inside object
    // support both old signature and new: check for autoSave in place of data by destructuring not possible here,
    // so expect callers include autoSave in the object; extract it if present
    // (the renderer sends { data, defaultPath, autoSave })
    const lastArg = arguments[1] || {};
    const autoSave = lastArg.autoSave === true;

    if (!target) {
      if (autoSave) {
        // save silently to appData/uploads/<defaultPath>
        const uploadsDir = path.join(app.getPath('userData'), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        target = path.join(uploadsDir, defaultPath || 'untitled.bin');
      } else {
        // Ask user where to save
        const { canceled, filePath: chosen } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), { defaultPath: defaultPath || 'untitled.txt' });
        if (canceled) return { ok: false, canceled: true };
        target = chosen;
      }
    }

    // Basic safety check: ensure a path was provided
    if (!target) return { ok: false, error: 'No file path specified' };

    // Accept data as string, Buffer, or ArrayBuffer
    let toWrite;
    if (data == null) {
      toWrite = '';
    } else if (Buffer.isBuffer(data)) {
      toWrite = data;
    } else if (data instanceof ArrayBuffer) {
      toWrite = Buffer.from(new Uint8Array(data));
    } else if (data && data.buffer && data.buffer instanceof ArrayBuffer) {
      // typed array-like
      toWrite = Buffer.from(new Uint8Array(data.buffer));
    } else if (typeof data === 'string') {
      toWrite = data;
    } else {
      // fallback: try JSON stringify
      toWrite = JSON.stringify(data);
    }

    await fs.writeFile(target, toWrite);

    // Notify renderer (optional) and return success
    try { event.sender.send('file-saved', { path: target }); } catch (e) { /* ignore send errors */ }
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Simple event listener from renderer
ipcMain.on('file-selected', (event, info) => {
  console.log('Renderer reported selected file:', info);
  // Could perform additional work here (e.g., copy file, read contents)
});

// Upload files via main process (avoid CORS / run in offline-capable main)
ipcMain.handle('upload-files', async (event, { files, uploadUrl }) => {
  // files: [{ name, data (ArrayBuffer or Buffer), mime }]
  try {
    if (!uploadUrl) return { ok: false, error: 'No uploadUrl provided' };
    const urlObj = new URL(uploadUrl);
    const isHttps = urlObj.protocol === 'https:';
    const boundary = '----electronform' + Date.now();
    const parts = [];

    for (const f of files) {
      const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.field || 'file'}"; filename="${f.name}"\r\nContent-Type: ${f.mime || 'application/octet-stream'}\r\n\r\n`);
      const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(new Uint8Array(f.data));
      const tail = Buffer.from('\r\n');
      parts.push(header, dataBuf, tail);
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length
      }
    };

    const httpLib = isHttps ? require('https') : require('http');

    const resBody = await new Promise((resolve, reject) => {
      const req = httpLib.request(options, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({ statusCode: res.statusCode, body: buf.toString(), headers: res.headers });
        });
      });
      req.on('error', (err) => reject(err));
      req.write(body);
      req.end();
    });

    return { ok: resBody.statusCode >= 200 && resBody.statusCode < 300, status: resBody.statusCode, body: resBody.body };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Window control handlers for frameless window (minimize/maximize/close)
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