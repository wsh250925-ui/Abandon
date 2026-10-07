const { resolveMediaFiles } = require('../../utils/media');
Page({
  data: { allArticles: [], articles: [], keyword: '', loading: true },
  onLoad() { this.loadCatalog(); },
  async loadCatalog() {
    try {
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'catalog' } });
      const rows = (r.result || {}).articles || [];
      const urlMap = await resolveMediaFiles(rows.map(x => x.coverFileId));
      const allArticles = rows.map(x => ({ ...x, cover: urlMap[x.coverFileId] || '../../images/home/infant.jpg', meta: x.summary || '急救知识图文课程' }));
      this.setData({ allArticles, articles: allArticles, loading: false });
    } catch (_) { this.setData({ loading: false }); wx.showToast({ title: '图文课加载失败', icon: 'none' }); }
  },
  onSearch(e) { const keyword = (e.detail.value || '').trim(); const lower = keyword.toLowerCase(); this.setData({ keyword, articles: this.data.allArticles.filter(x => !lower || `${x.title} ${x.summary || ''}`.toLowerCase().includes(lower)) }); },
  openArticle(e) { const id = e.currentTarget.dataset.id; if (id) wx.navigateTo({ url: `/pages/article/index?id=${id}` }); }
});
