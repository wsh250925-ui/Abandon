Page({
  data: { sets: [], allSets: [], setId: '', title: '知识问答', questions: [], index: 0, selected: -1, answers: [], submitted: false, result: null, keyword: '' },
  onLoad(options) { if (options.setId) this.loadQuiz(options.setId); else this.loadSets(); },
  async loadSets() {
    try { const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'catalog' } }); const allSets = r.result.quizSets || []; this.setData({ sets: allSets, allSets }); }
    catch (_) { wx.showToast({ title: '题库加载失败', icon: 'none' }); }
  },
  onSearch(e) { const keyword = (e.detail.value || '').trim(); const lower = keyword.toLowerCase(); this.setData({ keyword, sets: this.data.allSets.filter(x => !lower || `${x.title} ${x.description || ''}`.toLowerCase().includes(lower)) }); },
  selectSet(e) { this.loadQuiz(e.currentTarget.dataset.id); },
  async loadQuiz(setId) {
    try {
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'getQuiz', setId } });
      this.setData({ setId, title: r.result.set.title, questions: r.result.questions, index: 0, selected: -1, answers: [], submitted: false, result: null, sets: [] });
    } catch (_) { wx.showToast({ title: '题目加载失败', icon: 'none' }); }
  },
  choose(e) { if (!this.data.submitted) this.setData({ selected: Number(e.currentTarget.dataset.i) }); },
  async next() {
    if (this.data.selected < 0) return wx.showToast({ title: '请先选择答案', icon: 'none' });
    const answers = [...this.data.answers, this.data.selected];
    if (this.data.index + 1 < this.data.questions.length) return this.setData({ answers, index: this.data.index + 1, selected: -1 });
    try {
      wx.showLoading({ title: '提交中' });
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'submitQuiz', setId: this.data.setId, answers } });
      this.setData({ answers, submitted: true, result: r.result });
    } catch (e) { wx.showToast({ title: '提交失败，请重试', icon: 'none' }); }
    finally { wx.hideLoading(); }
  },
  retry() { this.loadQuiz(this.data.setId); },
  backSets() { this.setData({ setId: '', questions: [], result: null, submitted: false, keyword: '' }); this.loadSets(); }
});
