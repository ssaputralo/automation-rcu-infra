export default {
  name: 'ProgressBar',
  props: {
    progress: { type: Number, default: 0 },
    visible: { type: Boolean, default: false }
  },
  template: `
    <div class="progress-wrap" v-if="visible">
      <div class="progress-bar" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div class="progress-label">{{ progress }}%</div>
    </div>
  `
};
