const { resolveMediaFile } = require('../../utils/media');
Page({
  data: { days: 0, courses: 0, questions: 0, nickname: '微信用户', avatarUrl: '../../images/avatar.png', isAdmin: false, anonymousInRanking: false, week: [{ day: '一' }, { day: '二' }, { day: '三' }, { day: '四' }, { day: '五' }, { day: '六' }, { day: '日' }], recent: { title: '开始学习急救知识', lesson: '选择一门课程开始', progress: 0, currentText: '0分0秒', totalText: '0分0秒' }, shareText: '分享海报' },
  onShow() { const bar = this.getTabBar && this.getTabBar(); if (bar) bar.setActive(3); this.loadProfile(); },
  async loadProfile() {
    try {
      const [identity, profile, catalog] = await Promise.all([
        wx.cloud.callFunction({ name: 'learningApi', data: { action: 'identity' } }),
        wx.cloud.callFunction({ name: 'learningApi', data: { action: 'profile' } }),
        wx.cloud.callFunction({ name: 'learningApi', data: { action: 'catalog' } })
      ]);
      const p = profile.result || {}, daily = p.daily || [], progress = p.progress || [], lessons = (catalog.result || {}).lessons || [];
      const today = new Date(Date.now() + 8 * 3600000), monday = new Date(today);
      monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
      const week = ['一', '二', '三', '四', '五', '六', '日'].map((day, i) => { const date = new Date(monday); date.setUTCDate(monday.getUTCDate() + i); return { day, done: daily.some(x => x.day === date.toISOString().slice(0, 10) && (x.checkedIn || x.seconds > 0)) }; });
      let avatarUrl = p.user.avatarUrl ? await resolveMediaFile(p.user.avatarUrl) : '';
      if (!avatarUrl) avatarUrl = '../../images/avatar.png';
      const timeOf = value => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (value instanceof Date) return value.getTime();
        if (value.$date) return new Date(value.$date).getTime() || 0;
        return new Date(value).getTime() || 0;
      };
      const recentProgress = progress.slice().sort((a, b) => timeOf(b.updatedAt || b.createdAt) - timeOf(a.updatedAt || a.createdAt))[0] || progress[0];
      const recent = recentProgress ? (() => {
        const lesson = lessons.find(x => x._id === recentProgress.lessonId) || {};
        const current = Number(recentProgress.uniqueSeconds || 0), total = Number(lesson.duration || 0);
        return { title: lesson.title || '最近学习的课程', lesson: lesson.subtitle || lesson.description || '视频学习', progress: total ? Math.min(100, Math.round(current * 100 / total)) : 0, currentText: this.formatSeconds(current), totalText: this.formatSeconds(total), lessonId: lesson._id };
      })() : this.data.recent;
      this.setData({
        isAdmin: !!identity.result.admin,
        nickname: p.user.nickname || '微信用户', avatarUrl,
        anonymousInRanking: !!p.user.anonymousInRanking,
        days: daily.filter(x => x.checkedIn || x.seconds > 0).length, week,
        courses: progress.length, questions: (p.best || []).length, recent
      });
    } catch (_) { /* 云函数尚未部署时保留界面 */ }
  },
  formatSeconds(seconds) { const s = Math.max(0, Math.floor(Number(seconds || 0))); return `${Math.floor(s / 60)}分${s % 60}秒`; },
  chooseAvatar(e) {
    wx.compressImage({ src: e.detail.avatarUrl, quality: 65, success: compressed => {
      wx.getFileSystemManager().readFile({ filePath: compressed.tempFilePath, encoding: 'base64', success: async file => {
        try {
          const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'uploadAvatar', base64: file.data } });
          this.setData({ avatarUrl: await resolveMediaFile(r.result.fileID) || '../../images/avatar.png' });
        } catch (_) { wx.showToast({ title: '头像上传失败，请选更小图片', icon: 'none' }); }
      } });
    } });
  },
  async editNickname(e) { const nickname = (e.detail.value || '').trim(); if (nickname) await this.saveProfile({ nickname }); },
  async toggleAnonymous(e) {
    const previous = this.data.anonymousInRanking;
    const anonymousInRanking = e && e.detail && typeof e.detail.value === 'boolean' ? e.detail.value : !previous;
    this.setData({ anonymousInRanking });
    try { await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'saveProfile', anonymousInRanking } }); }
    catch (_) { this.setData({ anonymousInRanking: previous }); wx.showToast({ title: '保存失败，请检查云服务', icon: 'none' }); }
  },
  async saveProfile(data) { try { await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'saveProfile', ...data } }); this.setData(data); } catch (_) { wx.showToast({ title: '保存失败，请检查云服务', icon: 'none' }); } },
  sharePoster() { wx.showToast({ title: '分享海报功能后续开放', icon: 'none' }); },
  openStudy() { if (this.data.recent && this.data.recent.lessonId) wx.navigateTo({ url: `/pages/lesson/index?id=${this.data.recent.lessonId}` }); else wx.switchTab({ url: '/pages/study/index' }); },
  openAdmin() { if (this.data.isAdmin) wx.navigateTo({ url: '/pages/admin/index' }); },
  nav(e) { wx.switchTab({ url: e.currentTarget.dataset.url }); }
});
