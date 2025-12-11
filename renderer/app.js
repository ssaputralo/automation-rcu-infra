import UploadBox from './components/uploadBox.js';
import ToastList from './components/toastList.js';
import ProgressBar from './components/progressBar.js';

const allowedMap = {
  file1: { exts: ['.xls', '.xlsx'], mimes: ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  file2: { exts: ['.ppt', '.pptx'], mimes: ['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'] }
};

// Modular Vue App definition (exported as default)
export default {
  components: { UploadBox, ToastList, ProgressBar },
  data() {
    return {
      file1Name: 'No file selected',
      file2Name: 'No file selected',
      theme: (localStorage.getItem('theme')) ? localStorage.getItem('theme') : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      invalid1: false,
      invalid2: false,
      notifications: [],
      uploadUrl: 'http://localhost:3000/upload',
      submitting: false,
      progressPercent: 0,
      currentXhr: null,
      fileObjs: { file1: null, file2: null }
    };
  },
  computed: {
    canSubmit() {
      try {
        const has1 = this.fileObjs.file1 != null;
        const has2 = this.fileObjs.file2 != null;
        return !this.invalid1 && !this.invalid2 && has1 && has2;
      } catch (e) {
        return false;
      }
    }
  },
  methods: {
    openFile(slot) {
      const ref = slot === 'file1' ? 'file1' : 'file2';
      try { if (this.$refs[ref] && this.$refs[ref].open) this.$refs[ref].open(); } catch (e) { }
    },
    onSelected(slot, file) {
      if (!file) { this.clear(slot); return; }
      const allowed = slot === 'file1' ? allowedMap.file1 : allowedMap.file2;
      if (!this.isValidFile(file, allowed)) {
        this.setInvalid(slot, 'Unsupported file type');
        // ask child to clear its input
        try { if (this.$refs[slot] && this.$refs[slot].clear) this.$refs[slot].clear(); } catch (e) {}
        return;
      }

      this.clear(slot);
      if (slot === 'file1') {
        this.file1Name = file.name;
        this.fileObjs.file1 = file;
      } else {
        this.file2Name = file.name;
        this.fileObjs.file2 = file;
      }
    },
    isValidFile(file, allowed) {
      if (!file) return false;
      const name = file.name || '';
      const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
      if (allowed.exts.includes(ext)) return true;
      if (file.type && allowed.mimes.includes(file.type)) return true;
      return false;
    },
    setInvalid(slot, message) {
      if (slot === 'file1') { this.invalid1 = true; this.file1Name = message; }
      else { this.invalid2 = true; this.file2Name = message; }
    },
    clear(slot) {
      if (slot === 'file1') {
        this.invalid1 = false;
        this.file1Name = 'No file selected';
        this.fileObjs.file1 = null;
        try { if (this.$refs.file1 && this.$refs.file1.clear) this.$refs.file1.clear(); } catch (e) {}
      } else {
        this.invalid2 = false;
        this.file2Name = 'No file selected';
        this.fileObjs.file2 = null;
        try { if (this.$refs.file2 && this.$refs.file2.clear) this.$refs.file2.clear(); } catch (e) {}
      }
    },
    notify(message, type = 'info', timeout = 4000) {
      const id = Date.now() + Math.random();
      this.notifications.push({ id, message, type });
      setTimeout(() => {
        const idx = this.notifications.findIndex(n => n.id === id);
        if (idx !== -1) this.notifications.splice(idx, 1);
      }, timeout);
    },
    async submitFiles() {
      if (!this.canSubmit) {
        this.notify('Please select two valid files before submitting', 'error');
        return;
      }

      const f1 = this.fileObjs.file1;
      const f2 = this.fileObjs.file2;

      // If online, send files to backend via main process (IPC) so backend can process without saving locally
      if (window.navigator && window.navigator.onLine) {
        this.submitting = true;
        this.progressPercent = 0;
        try {
          const ab1 = await f1.arrayBuffer();
          const ab2 = await f2.arrayBuffer();

          const payload = {
            uploadUrl: this.uploadUrl,
            files: [
              { field: 'file1', name: f1.name, mime: f1.type || 'application/octet-stream', data: ab1 },
              { field: 'file2', name: f2.name, mime: f2.type || 'application/octet-stream', data: ab2 }
            ]
          };

          const res = await window.electronAPI.invoke('upload-files', payload);
          if (res && res.ok) {
            this.progressPercent = 100;
            this.notify('Upload successful (backend processed without saving)', 'success');
          } else {
            const msg = (res && (res.error || res.body)) ? (res.error || res.body) : 'Upload failed';
            this.notify(`Upload failed: ${msg}`, 'error');
          }
        } catch (err) {
          console.error('submitFiles (upload via IPC) error', err);
          this.notify(`Upload failed: ${err.message}`, 'error');
        } finally {
          setTimeout(() => { this.progressPercent = 0; }, 800);
          this.submitting = false;
          this.currentXhr = null;
        }
        return;
      }

      // Offline fallback: save files locally
      this.submitting = true;
      this.progressPercent = 0;
      try {
        const ab1 = await f1.arrayBuffer();
        const res1 = await window.electronAPI.invoke('save-file', { data: ab1, defaultPath: f1.name, autoSave: true });
        if (!res1 || !res1.ok) throw new Error((res1 && res1.error) || 'Failed to save file 1');
        const ab2 = await f2.arrayBuffer();
        const res2 = await window.electronAPI.invoke('save-file', { data: ab2, defaultPath: f2.name, autoSave: true });
        if (!res2 || !res2.ok) throw new Error((res2 && res2.error) || 'Failed to save file 2');
        this.progressPercent = 100;
        this.notify('Files saved locally (offline)', 'success');
      } catch (err) {
        console.error('submitFiles (local save) error', err);
        this.notify(`Local save failed: ${err.message}`, 'error');
      } finally {
        setTimeout(() => { this.progressPercent = 0; }, 800);
        this.submitting = false;
        this.currentXhr = null;
      }
    },
    cancelUpload() {
      if (this.currentXhr) {
        try {
          this.currentXhr.abort();
        } catch (e) { /* ignore */ }
        this.currentXhr = null;
      }
      this.submitting = false;
      this.progressPercent = 0;
      this.notify('Upload cancelled', 'info');
    }
    ,
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      try { document.documentElement.setAttribute('data-theme', this.theme); } catch (e) {}
      try { localStorage.setItem('theme', this.theme); } catch (e) {}
    }
  },
  mounted() {
    try {
      document.documentElement.setAttribute('data-theme', this.theme || 'light');
    } catch (e) { }
  }
};
