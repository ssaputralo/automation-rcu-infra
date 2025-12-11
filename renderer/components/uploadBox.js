export default {
  name: 'UploadBox',
  props: {
    label: { type: String, default: 'Upload' },
    accept: { type: String, default: '' },
    filename: { type: String, default: 'Belum ada file dipilih' },
    invalid: { type: Boolean, default: false }
  },
  template: `
    <div :class="['upload-box', { invalid: invalid }]" ref="box"
         @click="onClick"
         @dragover.prevent="onDragOver"
         @dragleave.prevent="onDragLeave"
         @drop.prevent="onDrop">
      <label>{{ label }}</label>
      <div class="upload-hint">Klik untuk memilih file atau seret ke sini</div>
      <input ref="input" type="file" :accept="accept" @change="onChange" style="display:none" />
      <div class="filename">{{ filename }}</div>
    </div>
  `,
  methods: {
    onClick() {
      this.$refs.input.click();
    },
    onChange(e) {
      const f = e.target.files && e.target.files[0];
      if (f) this.$emit('file', f);
    },
    onDragOver() {
      this.$refs.box.style.borderColor = '#007acc';
    },
    onDragLeave() {
      this.$refs.box.style.borderColor = '';
    },
    onDrop(e) {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      const f = files[0];
      this.$emit('file', f);
      this.$refs.box.style.borderColor = '';
    },
    open() {
      this.$refs.input.click();
    },
    clear() {
      try { this.$refs.input.value = ''; } catch (e) { }
      this.$refs.box.style.borderColor = '';
    }
  }
};
