export default {
  name: 'ToastList',
  props: { notifications: { type: Array, default: () => [] } },
  template: `
    <div class="toast-container">
      <div v-for="n in notifications" :key="n.id" :class="['toast', n.type]">{{ n.message }}</div>
    </div>
  `
};
