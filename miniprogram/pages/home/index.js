const { resolveMediaFiles } = require('../../utils/media');
Page({
  onShow() { const bar = this.getTabBar && this.getTabBar(); if (bar) bar.setActive(0); this.loadHome(); },
  data: {
    course: null,
    question: { id: '', stem: '每日急救知识将在这里出现', explanation: '' },
    options: [],
    selectedAnswer: -1,
    hasAnswered: false,
    emergencyPressing: false,
    courses: [], currentCourseIndex: 0, recommendedArticle: null, recentId: '', loading: true
  },
  async loadHome() {
    try {
      const [catalogResult, profileResult] = await Promise.all([
        wx.cloud.callFunction({ name: 'learningApi', data: { action: 'catalog' } }),
        wx.cloud.callFunction({ name: 'learningApi', data: { action: 'profile' } })
      ]);
      const catalog = catalogResult.result || {}, progress = (profileResult.result || {}).progress || [], lessons = catalog.lessons || [];
      const articles = catalog.articles || [];
      const covers = await resolveMediaFiles([...lessons.map(x => x.coverFileId), ...(catalog.courses || []).map(x => x.coverFileId), ...articles.map(x => x.coverFileId)]);
      const courseMap = Object.fromEntries((catalog.courses || []).map(x => [x._id, x]));
      const groups = (catalog.courses || []).map(group => { const groupLessons = lessons.filter(x => x.courseId === group._id); const first = groupLessons[0] || {}; const total = Number(group.totalDuration || groupLessons.reduce((sum, x) => sum + Number(x.duration || 0), 0)); return { id: first._id, title: group.title, category: group.badge || '课程组', meta: `${Math.ceil(total / 60)}分钟`, score: group.description || '急救知识学习', cover: covers[group.coverFileId] || covers[first.coverFileId] || '../../images/home/cpr.jpg', tone: 'blue', kind: 'group' }; });
      const groupedIds = new Set((catalog.courses || []).map(x => x._id));
      const singles = lessons.filter(x => !x.courseId || !groupedIds.has(x.courseId)).map(x => ({ id: x._id, title: x.title, category: '独立视频课', meta: `${Math.ceil((x.duration || 0) / 60)}分钟`, score: x.subtitle || '急救知识学习', cover: covers[x.coverFileId] || '../../images/home/cpr.jpg', tone: 'slate', kind: 'single' }));
      const courses = [...groups, ...singles].slice(0, 5);
      const latest = progress[0], recent = latest && lessons.find(x => x._id === latest.lessonId) || lessons[0];
      if (recent) { const current = latest && latest.lessonId === recent._id ? Math.min(Number(latest.uniqueSeconds || 0), Number(recent.duration || 0)) : 0; const total = Number(recent.duration || 0); this.setData({ recentId: recent._id, course: { title: recent.title, lesson: recent.description || '视频学习', percent: total ? Math.min(100, Math.round(current * 100 / total)) : 0, currentText: this.formatSeconds(current), totalText: this.formatSeconds(total), cover: covers[recent.coverFileId] || '../../images/home/cpr.jpg' } }); }
      const recommendedArticle = articles[0] ? { ...articles[0], cover: covers[articles[0].coverFileId] || '../../images/home/infant.jpg', summary: articles[0].summary || '急救知识图文速读' } : null;
      this.setData({ courses, currentCourseIndex: 0, recommendedArticle, loading: false });
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'dailyQuestion' } });
      const q = r.result; if (q) { const answered = !!q.answered; const selected = Number(q.selectedAnswer); this.setData({ question: { id: q._id, stem: q.stem, explanation: q.explanation || '' }, options: q.options.slice(0, 4).map((text, i) => ({ letter: 'ABCD'[i], text, index: i, state: answered ? (i === q.answer ? 'is-correct' : (i === selected && !q.correct ? 'is-wrong' : '')) : '' })), hasAnswered: answered, selectedAnswer: answered ? selected : -1, quickResult: answered ? { correct: !!q.correct, explanation: q.explanation || '' } : null }); }
    } catch (_) { this.setData({ loading: false }); }
  },
  formatSeconds(seconds) { const s = Math.max(0, Math.floor(Number(seconds || 0))); const m = Math.floor(s / 60); return `${m}分${s % 60}秒`; },
  async chooseAnswer(e) {
    if (this.data.hasAnswered) return;
    const index = Number(e.currentTarget.dataset.index); this.setData({ selectedAnswer: index });
    try { const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'submitQuick', questionId: this.data.question.id, answer: index } }); const result = r.result || {}; const options = this.data.options.map((x, i) => ({ ...x, state: i === result.answer ? 'is-correct' : (i === index && !result.correct ? 'is-wrong' : '') })); this.setData({ options, hasAnswered: true, quickResult: result }); } catch (_) { wx.showToast({ title: '提交失败，请重试', icon: 'none' }); }
  },
  openCourse(e) { const id = e && e.currentTarget.dataset.id || this.data.recentId; if (id) wx.navigateTo({ url: `/pages/lesson/index?id=${id}` }); else wx.switchTab({ url: '/pages/study/index' }); },
  openQuestions() { wx.navigateTo({ url: '/pages/quiz/index' }); },
  openVideoList() { wx.navigateTo({ url: '/pages/video-list/index' }); },
  openArticle(e) { const id = e && e.currentTarget.dataset.id || (this.data.recommendedArticle && this.data.recommendedArticle._id); if (id) wx.navigateTo({ url: `/pages/article/index?id=${id}` }); },
  onCourseSwiperChange(e) { this.setData({ currentCourseIndex: Number(e.detail.current || 0) }); },
  nav(event) { wx.switchTab({ url: event.currentTarget.dataset.url }); },
  startEmergency() {
    if (this.data.emergencyPressing) return;
    this.setData({ emergencyPressing: true });
    wx.vibrateShort({ type: 'light' });
    this.emergencyVibrateTimer = setInterval(() => wx.vibrateShort({ type: 'light' }), 1000);
    this.emergencyTimer = setTimeout(() => {
      if (this.emergencyVibrateTimer) clearInterval(this.emergencyVibrateTimer);
      this.emergencyVibrateTimer = null;
      this.setData({ emergencyPressing: false });
      wx.showModal({ title: '呼叫急救电话', content: '是否呼叫 120？', confirmText: '呼叫', confirmColor: '#bb0112', success: (res) => { if (res.confirm) wx.makePhoneCall({ phoneNumber: '120' }); } });
    }, 3000);
  },
  cancelEmergency() {
    if (this.emergencyTimer) clearTimeout(this.emergencyTimer);
    if (this.emergencyVibrateTimer) clearInterval(this.emergencyVibrateTimer);
    this.setData({ emergencyPressing: false });
    this.emergencyVibrateTimer = null;
  }
});
