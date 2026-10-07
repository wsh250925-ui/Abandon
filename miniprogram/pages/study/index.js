const { resolveMediaFiles } = require('../../utils/media');
Page({
  data: {
    videoCourses: [], questions: [], articles: [], currentVideoIndex: 0,
    fallbackVideos: [
      { title: '成人心肺复苏黄金4分钟', meta: '演示课程', time: '15:20', cover: '../../images/home/cpr.jpg' },
      { title: '儿童气道异物科学处理', meta: '演示课程', time: '06:45', cover: '../../images/home/infant.jpg' },
      { title: '骨折现场临时固定与包扎', meta: '演示课程', time: '09:12', cover: '../../images/home/bandage.jpg' }
    ]
  },
  onShow() { const bar = this.getTabBar && this.getTabBar(); if (bar) bar.setActive(2); this.loadCatalog(); },
  async loadCatalog() {
    try {
      const res = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'catalog' } });
      const data = res.result || {};
      const lessons = data.lessons || [], groups = data.courses || [];
      const urlMap = await resolveMediaFiles([...lessons.map(x => x.coverFileId), ...groups.map(x => x.coverFileId), ...(data.articles || []).map(x => x.coverFileId)]);
      const groupIds = new Set(groups.map(x => x._id));
      const grouped = groups.map(group => { const members = lessons.filter(x => x.courseId === group._id), first = members[0] || {}; return { ...first, _id: first._id, title: group.title, meta: group.description || '课程组学习', time: `${Math.ceil(Number(group.totalDuration || members.reduce((s, x) => s + Number(x.duration || 0), 0)) / 60)}分钟`, cover: urlMap[group.coverFileId] || urlMap[first.coverFileId] || '../../images/home/cpr.jpg', cardKind: 'group', badge: group.badge || '课程组' }; });
      const singles = lessons.filter(x => !x.courseId || !groupIds.has(x.courseId)).map(x => ({ ...x, meta: x.subtitle || x.description || '独立视频课', time: `${Math.ceil((x.duration || 0) / 60)}分钟`, cover: urlMap[x.coverFileId] || '../../images/home/cpr.jpg', cardKind: 'single', badge: '独立课程' }));
      this.setData({
        videoCourses: [...grouped, ...singles],
        questions: (data.quizSets || []).map(x => ({ id: x._id, title: x.title, tag: x.description })),
        articles: (data.articles || []).map(x => ({ ...x, meta: x.summary || '图文课程', cover: urlMap[x.coverFileId] || '../../images/home/infant.jpg' })), currentVideoIndex: 0
      });
    } catch (_) { this.setData({ videoCourses: this.data.fallbackVideos }); }
  },
  onSwiperChange(e) { this.setData({ currentVideoIndex: Number(e.detail.current || 0) }); },
  quiz(e) { const id = e && e.currentTarget.dataset.id; wx.navigateTo({ url: `/pages/quiz/index${id ? '?setId=' + id : ''}` }); },
  openVideoList() { wx.navigateTo({ url: '/pages/video-list/index' }); },
  openArticleList() { wx.navigateTo({ url: '/pages/article-list/index' }); },
  openQuizList() { wx.navigateTo({ url: '/pages/quiz/index' }); },
  rank() { wx.navigateTo({ url: '/pages/ranking/index' }); },
  openVideo(e) { const id = e.currentTarget.dataset.id; if (id) wx.navigateTo({ url: `/pages/lesson/index?id=${id}` }); else wx.showToast({ title: '请先在后台上传演示视频', icon: 'none' }); },
  openArticle(e) { const id = e.currentTarget.dataset.id; if (id) wx.navigateTo({ url: `/pages/article/index?id=${id}` }); },
  nav(e) { wx.switchTab({ url: e.currentTarget.dataset.url }); }
});
