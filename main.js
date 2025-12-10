const { app, BrowserWindow } = require('electron')

const createWindow = () => {
    // Membuat jendela browser
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      title: "Patch Report Checking Automation",
      // Konfigurasi agar bisa pakai Node.js di HTML (opsional tapi berguna buat pemula)
      webPreferences: {
        nodeIntegration: true, 
        contextIsolation: false 
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