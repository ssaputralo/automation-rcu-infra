export default {
  name: 'ToastList',
  props: { notifications: { type: Array, default: () => [] } },
  template: `
    <div class="toast-container">
      <div v-for="n in notifications" :key="n.id" :class="['toast', n.type]"><i :class="iconClass(n.type)"></i> {{ n.message }}</div>
    </div>
  `,
  methods: {
    iconClass(type) {
      switch (type) {
        case 'success': return 'fa fa-check-circle toast-icon';
        case 'error': return 'fa fa-exclamation-circle toast-icon';
        default: return 'fa fa-info-circle toast-icon';
      }
    }
  }
};
