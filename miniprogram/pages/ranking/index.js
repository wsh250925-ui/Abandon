const DEMO_ROWS = [
  { rank: 1, nickname: '李晓晨', avatarText: '李', value: 18.5 * 3600 },
  { rank: 2, nickname: '张伟医生', avatarText: '张', value: 15.2 * 3600 },
  { rank: 3, nickname: '王敏志愿者', avatarText: '王', value: 13.8 * 3600 },
  { rank: 4, nickname: '陈立明', avatarText: '陈', value: 12.4 * 3600 },
  { rank: 5, nickname: '赵一', avatarText: '赵', value: 11.9 * 3600 },
  { rank: 6, nickname: '林老师', avatarText: '林', value: 10.6 * 3600 },
  { rank: 7, nickname: '周同学', avatarText: '周', value: 9.8 * 3600 },
  { rank: 8, nickname: '匿名学习者', avatarText: '匿', value: 8.7 * 3600 }
];
Page({
  data: { metric: 'time', period: 'week', rows: [], podium: [], followRows: [], loading: false, demo: false, myRank: '暂未上榜', myGap: '完成学习或答题即可进入榜单' },
  onLoad() { this.load(); },
  choose(e) { const data = { [e.currentTarget.dataset.k]: e.currentTarget.dataset.v }; this.setData(data, () => this.load()); },
  formatValue(value) { const n = Number(value || 0); return this.data.metric === 'time' ? `${(n / 3600).toFixed(1)}小时` : `${Math.round(n)}分`; },
  normalize(raw) {
    const source = raw.length ? raw : DEMO_ROWS;
    const rows = source.slice(0, 10).map((x, i) => ({ ...x, rank: i + 1, display: this.formatValue(x.value), avatarText: x.nickname ? x.nickname.slice(0, 1) : '' }));
    while (rows.length < 10) rows.push({ rank: rows.length + 1, nickname: '', display: '', avatarText: '', empty: true });
    return rows;
  },
  async load() {
    this.setData({ loading: true });
    try {
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'ranking', metric: this.data.metric, period: this.data.period } });
      const raw = (r.result || []).map(x => ({ ...x, display: this.formatValue(x.value) }));
      const rows = this.normalize(raw);
      this.setData({ rows, podium: rows.slice(0, 3), followRows: rows.slice(3), demo: !raw.length, myRank: raw.length ? '暂未上榜' : '第8名（演示）', myGap: raw.length ? '完成更多课程，进入前十榜单' : '完成学习后会替换为真实排名' });
    } catch (_) {
      const rows = this.normalize([]); this.setData({ rows, podium: rows.slice(0, 3), followRows: rows.slice(3), demo: true, myRank: '第8名（演示）', myGap: '完成学习后会替换为真实排名' }); wx.showToast({ title: '排行榜加载失败，显示演示榜单', icon: 'none' });
    } finally { this.setData({ loading: false }); }
  },
  goStudy() { wx.switchTab({ url: '/pages/study/index' }); }
});
