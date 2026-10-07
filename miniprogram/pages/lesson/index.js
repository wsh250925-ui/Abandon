const { resolveMediaFile } = require('../../utils/media');
Page({
  data: { lesson: { title: '课程详情', description: '正在加载课程内容…' }, lessons: [], course: null, pageTitle: '课程详情', uniqueSeconds: 0, playable: false, isGrouped: false, currentIndex: 0, totalDuration: 0, totalDurationText: '0分0秒', completedCount: 0, videoUrl: '' },
  onLoad(options) { this.lessonId = options.id; this.loadLesson(); },
  formatSeconds(seconds) { const s = Math.max(0, Math.floor(Number(seconds || 0))); return `${Math.floor(s / 60)}分${s % 60}秒`; },
  async loadLesson() {
    try {
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'getLesson', id: this.lessonId } });
      const data = r.result || {}, lesson = data.lesson, lessons = data.lessons || [lesson], currentProgress = data.currentProgress || {};
      let videoUrl = '';
      if (lesson.videoFileId) videoUrl = await resolveMediaFile(lesson.videoFileId);
      const progressMap = Object.fromEntries((data.progresses || []).map(x => [x.lessonId, x]));
      const decorated = lessons.map((item, index) => { const p = progressMap[item._id] || {}, watched = Number(p.uniqueSeconds || 0), duration = Number(item.duration || 0), percent = duration ? Math.min(100, Math.round(watched * 100 / duration)) : 0; return { ...item, index: index + 1, watched, percent, status: item._id === lesson._id ? 'current' : (percent >= 95 ? 'done' : 'todo'), durationText: this.formatSeconds(duration) }; });
      const currentIndex = decorated.findIndex(x => x._id === lesson._id), totalDuration = decorated.reduce((sum, x) => sum + Number(x.duration || 0), 0);
      this.setData({ lesson, lessons: decorated, course: data.course || null, pageTitle: data.course ? data.course.title : lesson.title, uniqueSeconds: Number(currentProgress.uniqueSeconds || 0), playable: !!videoUrl, videoUrl, isGrouped: !!data.course, currentIndex: Math.max(0, currentIndex), totalDuration, totalDurationText: this.formatSeconds(totalDuration), completedCount: decorated.filter(x => x.percent >= 95).length });
    } catch (_) { wx.showToast({ title: '无法加载课程', icon: 'none' }); }
  },
  onPlay() { this.playing = true; this.lastPosition = null; this.lastWall = null; },
  onPause() { this.playing = false; this.flush(); },
  onEnded() { this.playing = false; this.flush(); },
  onUnload() { this.flush(); },
  onTimeUpdate(e) {
    if (!this.playing) return;
    const position = Number(e.detail.currentTime), now = Date.now();
    if (!Number.isFinite(position)) return;
    if (this.lastPosition !== null && this.lastWall !== null) {
      const delta = position - this.lastPosition, elapsed = (now - this.lastWall) / 1000;
      if (delta > 0 && delta <= elapsed + 0.75 && delta <= 30) {
        this.pending = this.pending || []; const tail = this.pending[this.pending.length - 1];
        if (tail && Math.abs(tail.to - this.lastPosition) < 0.1 && position - tail.from <= 25) { tail.to = position; tail.elapsed += elapsed; }
        else this.pending.push({ from: this.lastPosition, to: position, elapsed });
        if (this.pending.reduce((sum, x) => sum + x.to - x.from, 0) >= 5) this.flush();
      }
    }
    this.lastPosition = position; this.lastWall = now;
  },
  onSeeking() { this.lastPosition = null; this.lastWall = null; },
  async flush() {
    if (this.sending || !this.pending || !this.pending.length) return;
    this.sending = true; const interval = this.pending.shift();
    try { const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'recordWatch', lessonId: this.lessonId, ...interval } }); this.setData({ uniqueSeconds: r.result.uniqueSeconds }); }
    catch (_) { this.pending.unshift(interval); }
    finally { this.sending = false; if (this.pending.length) this.flush(); }
  },
  openLesson(e) { const id = e.currentTarget.dataset.id; if (id && id !== this.lessonId) wx.redirectTo({ url: `/pages/lesson/index?id=${id}` }); },
  previous() { const item = this.data.lessons[this.data.currentIndex - 1]; if (item) this.openLesson({ currentTarget: { dataset: { id: item._id } } }); },
  next() { const item = this.data.lessons[this.data.currentIndex + 1]; if (item) this.openLesson({ currentTarget: { dataset: { id: item._id } } }); },
  openStudyList() { wx.switchTab({ url: '/pages/study/index' }); }
});
