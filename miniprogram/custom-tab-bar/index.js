const tabs = [
  { path: '/pages/home/index', label: '首页', icon: '◉' },
  { path: '/pages/aed/index', label: 'AED导航', icon: '⌖' },
  { path: '/pages/study/index', label: '学习', icon: '◇' },
  { path: '/pages/profile/index', label: '我的', icon: '♙' }
];

Component({
  data: { tabs, active: 0, pressing: false },
  lifetimes: {
    detached() { this.cancelEmergency(); }
  },
  methods: {
    setActive(index) { this.setData({ active: index }); },
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      if (!Number.isInteger(index) || !tabs[index] || index === this.data.active) return;
      wx.switchTab({ url: tabs[index].path });
    },
    startEmergency() {
      if (this.data.pressing) return;
      this.setData({ pressing: true });
      wx.vibrateShort({ type: 'light' });
      this.vibrateTimer = setInterval(() => wx.vibrateShort({ type: 'light' }), 1000);
      this.emergencyTimer = setTimeout(() => {
        this.emergencyTimer = null;
        if (this.vibrateTimer) clearInterval(this.vibrateTimer);
        this.vibrateTimer = null;
        this.setData({ pressing: false });
        wx.vibrateShort({ type: 'medium' });
        wx.showModal({
          title: '呼叫急救电话',
          content: '是否呼叫 120？',
          confirmText: '呼叫',
          confirmColor: '#bb0112',
          success: (result) => { if (result.confirm) wx.makePhoneCall({ phoneNumber: '120' }); }
        });
      }, 3000);
    },
    cancelEmergency() {
      if (this.emergencyTimer) clearTimeout(this.emergencyTimer);
      this.emergencyTimer = null;
      if (this.vibrateTimer) clearInterval(this.vibrateTimer);
      this.vibrateTimer = null;
      if (this.data.pressing) this.setData({ pressing: false });
    }
  }
});
