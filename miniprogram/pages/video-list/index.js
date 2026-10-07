const { resolveMediaFiles } = require('../../utils/media');
Page({
  data: { allCourses: [], courses: [], keyword: '', loading: true },
  onLoad() { this.loadCatalog(); },
  async loadCatalog() {
    try {
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'catalog' } });
      const data = r.result || {}, lessons = data.lessons || [], groups = data.courses || [];
      const urlMap = await resolveMediaFiles([...lessons.map(x => x.coverFileId), ...groups.map(x => x.coverFileId)]);
      const groupIds = new Set(groups.map(x => x._id));
      const grouped = groups.map(group => {
        const members = lessons.filter(x => x.courseId === group._id), first = members[0] || {};
        const total = Number(group.totalDuration || members.reduce((sum, x) => sum + Number(x.duration || 0), 0));
        return { id: first._id || '', title: group.title, description: group.description || '课程组学习', badge: group.badge || '课程组', durationText: `${Math.ceil(total / 60)}分钟`, lessonCount: members.length, cover: urlMap[group.coverFileId] || urlMap[first.coverFileId] || '../../images/home/cpr.jpg', grouped: true };
      });
      const singles = lessons.filter(x => !x.courseId || !groupIds.has(x.courseId)).map(x => ({ id: x._id, title: x.title, description: x.subtitle || x.description || '独立视频课程', badge: '独立课程', durationText: `${Math.ceil(Number(x.duration || 0) / 60)}分钟`, lessonCount: 1, cover: urlMap[x.coverFileId] || '../../images/home/cpr.jpg', grouped: false }));
      const allCourses = [...grouped, ...singles];
      this.setData({ allCourses, courses: allCourses, loading: false });
    } catch (_) { this.setData({ loading: false }); wx.showToast({ title: '视频课加载失败', icon: 'none' }); }
  },
  onSearch(e) { const keyword = (e.detail.value || '').trim(); const lower = keyword.toLowerCase(); this.setData({ keyword, courses: this.data.allCourses.filter(x => !lower || `${x.title} ${x.description} ${x.badge}`.toLowerCase().includes(lower)) }); },
  startLesson(e) { const id = e.currentTarget.dataset.id; if (id) wx.navigateTo({ url: `/pages/lesson/index?id=${id}` }); else wx.showToast({ title: '该课程暂未添加课时', icon: 'none' }); }
});
