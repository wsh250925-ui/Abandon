const { resolveMediaFiles } = require('../../utils/media');
const { persistImages, rewriteImages, articleBlocks } = require('../../utils/article-content');
const TEMPLATES = {
  courses: { title: '新课程组', description: '', badge: '实操演练', coverFileId: '', published: false, order: 99 },
  lessons: { courseId: '', title: '新视频课', subtitle: '', description: '', videoFileId: '', duration: 0, coverFileId: '', published: false, order: 99 },
  articles: { title: '新图文', summary: '', content: '', coverFileId: '', published: false, order: 99 },
  quizSets: { title: '新题组', description: '', published: false, order: 99 },
  questions: { setId: 'demo_cpr', stem: '题干', options: ['选项 A', '选项 B', '选项 C', '选项 D'], answer: 0, explanation: '答案解析', published: false, order: 99 },
  users: {}, settings: { key: '示例配置', value: '' }
};
const TYPES = [
  { key: 'courses', label: '课程' }, { key: 'lessons', label: '视频课' },
  { key: 'articles', label: '图文课' }, { key: 'quizSets', label: '题组' },
  { key: 'questions', label: '题目' }, { key: 'users', label: '用户' }, { key: 'settings', label: '配置' },
  { key: 'quizAttempts', label: '答题记录', readOnly: true }, { key: 'quizBest', label: '最佳成绩', readOnly: true },
  { key: 'lessonProgress', label: '观看进度', readOnly: true }, { key: 'dailyStudy', label: '每日时长', readOnly: true },
  { key: 'adminAuditLogs', label: '操作日志', readOnly: true }
];
Page({
  data: { ready: false, error: '', openid: '', types: TYPES, typeIndex: 0, rows: [], editor: '', form: {}, currentId: '', uploading: false, uploadStatus: '', articleImageMap: {}, courseOptions: [{ _id: '', title: '不加入课程组（独立课程）' }], coursePickerIndex: 0 },
  onEditorReady() { wx.createSelectorQuery().in(this).select('#articleEditor').context(res => { this.articleEditorCtx = res && res.context; if (this.articleEditorCtx) this.restoreArticleEditor(); }).exec(); },
  async restoreArticleEditor() {
    if (this.data.typeIndex !== 2 || !this.articleEditorCtx) return;
    const version = this.articleEditorVersion = (this.articleEditorVersion || 0) + 1;
    this.articleEditorLoading = true;
    const html = persistImages(this.data.form.content || '', this.data.articleImageMap);
    const refs = articleBlocks(html).filter(x => x.type === 'image').map(x => x.ref);
    const map = await resolveMediaFiles(refs, { preferRemote: true });
    if (version !== this.articleEditorVersion || this.data.typeIndex !== 2 || !this.data.editor) return;
    const articleImageMap = {};
    Object.keys(map).forEach(ref => { if (/^cloud:\/\//.test(ref)) articleImageMap[map[ref]] = ref; });
    this.setData({ articleImageMap });
    this.articleEditorCtx.setContents({ html: rewriteImages(html, src => map[src] || src), success: () => { if (version === this.articleEditorVersion) this.articleEditorLoading = false; }, fail: () => { if (version === this.articleEditorVersion) { this.articleEditorLoading = false; wx.showToast({ title: '编辑器加载失败，请重开记录', icon: 'none' }); } } });
  },
  onArticleInput(e) { const form = { ...this.data.form, content: e.detail.html || '' }; this.setData({ form }); },
  async onLoad() {
    try {
      const res = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'identity' } });
      const identity = res.result || {};
      this.setData({ openid: identity.openid, ready: !!identity.admin, error: identity.admin ? '' : '未加入管理员白名单。请将本页显示的 OpenID 配置到云函数环境变量 ADMIN_OPENIDS。' });
      if (identity.admin) { this.loadRows(); this.loadCourseOptions(); }
    } catch (e) { this.setData({ error: '云函数尚未部署或调用失败' }); }
  },
  async bootstrap() {
    try {
      wx.showLoading({ title: '建表并写入示例' });
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'bootstrap' } });
      wx.showToast({ title: `写入 ${r.result.inserted} 条`, icon: 'none' });
      this.loadRows();
    } catch (e) { wx.showModal({ title: '初始化失败', content: String(e.message || e), showCancel: false }); }
    finally { wx.hideLoading(); }
  },
  changeType(e) { this.articleEditorVersion = (this.articleEditorVersion || 0) + 1; this.articleEditorCtx = null; this.setData({ typeIndex: Number(e.detail.value), currentId: '', editor: '', uploadStatus: '', articleImageMap: {} }); this.loadRows(); if (Number(e.detail.value) === 1) this.loadCourseOptions(); },
  async loadCourseOptions() { try { const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'adminList', collection: 'courses' } }); this.setData({ courseOptions: [{ _id: '', title: '不加入课程组（独立课程）' }, ...(r.result || []).map(x => ({ _id: x._id, title: `${x.title}（${x._id}）` }))] }); } catch (_) {} },
  async loadRows() {
    try {
      const collection = TYPES[this.data.typeIndex].key;
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'adminList', collection } });
      this.setData({ rows: (r.result || []).map(x => ({ ...x, display: x.title || x.stem || x.nickname || x.key || x._id })) });
    } catch (e) { this.setData({ rows: [] }); wx.showToast({ title: '读取失败，请先初始化', icon: 'none' }); }
  },
  newRecord() { const key = TYPES[this.data.typeIndex].key; if (TYPES[this.data.typeIndex].readOnly || this.data.uploading || this.saving) return; this.articleEditorVersion = (this.articleEditorVersion || 0) + 1; const form = { ...TEMPLATES[key] }; this.setData({ form, editor: JSON.stringify(form, null, 2), currentId: '', uploadStatus: '', articleImageMap: {}, coursePickerIndex: 0 }, () => { if (this.articleEditorCtx) this.restoreArticleEditor(); }); },
  editRecord(e) { if (this.data.uploading || this.saving) return; const row = this.data.rows[Number(e.currentTarget.dataset.index)]; if (!row) return; this.articleEditorVersion = (this.articleEditorVersion || 0) + 1; const { display, ...form } = row; const coursePickerIndex = Math.max(0, this.data.courseOptions.findIndex(x => x._id === form.courseId)); this.setData({ currentId: row._id, form, editor: JSON.stringify(form, null, 2), uploadStatus: '', articleImageMap: {}, coursePickerIndex }, () => { if (this.articleEditorCtx) this.restoreArticleEditor(); }); },
  editText(e) { const editor = e.detail.value; let form = this.data.form; try { form = JSON.parse(editor); } catch (_) {} this.setData({ editor, form }); },
  updateField(e) { const field = e.currentTarget.dataset.field; const value = e.detail.value; const form = { ...this.data.form, [field]: field === 'order' || field === 'duration' ? Number(value) : value }; this.setData({ form, editor: JSON.stringify(form, null, 2) }); },
  updateOption(e) { const options = [...(this.data.form.options || [])]; options[Number(e.currentTarget.dataset.index)] = e.detail.value; const form = { ...this.data.form, options }; this.setData({ form, editor: JSON.stringify(form, null, 2) }); },
  updateAnswer(e) { const form = { ...this.data.form, answer: Number(e.detail.value) }; this.setData({ form, editor: JSON.stringify(form, null, 2) }); },
  updatePublished(e) { const form = { ...this.data.form, published: !!e.detail.value }; this.setData({ form, editor: JSON.stringify(form, null, 2) }); },
  updateCourse(e) { const coursePickerIndex = Number(e.detail.value); const courseId = this.data.courseOptions[coursePickerIndex]._id; const form = { ...this.data.form, courseId }; this.setData({ coursePickerIndex, form, editor: JSON.stringify(form, null, 2) }); },
  async save() {
    if (this.saving || this.data.uploading) return;
    if (this.data.typeIndex === 2 && this.articleEditorLoading) return wx.showToast({ title: '图片准备中，请稍等', icon: 'none' });
    this.saving = true;
    try {
      let html = this.data.form.content || '';
      if (this.data.typeIndex === 2 && this.articleEditorCtx) { const contents = await new Promise((resolve, reject) => this.articleEditorCtx.getContents({ success: resolve, fail: reject })); html = contents.html || ''; }
      const record = this.data.typeIndex === 2 ? { ...this.data.form, content: persistImages(html, this.data.articleImageMap) } : JSON.parse(this.data.editor);
      if (this.data.typeIndex === 2 && articleBlocks(record.content).some(x => x.type === 'image' && /^(wxfile:|http:\/\/tmp\/|blob:)/.test(x.ref))) throw new Error('正文含未上传的本地图片，请用“在光标处插入图片”重新上传该图片。');
      if (this.data.currentId) record._id = this.data.currentId;
      const collection = TYPES[this.data.typeIndex].key;
      await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'adminSave', collection, record } });
      wx.showToast({ title: '已保存' }); this.setData({ editor: '', form: {}, currentId: '', articleImageMap: {} }); this.loadRows();
    } catch (e) { wx.showModal({ title: '保存失败', content: String(e.message || e), showCancel: false }); }
    finally { this.saving = false; }
  },
  remove() {
    const id = this.data.currentId, collection = TYPES[this.data.typeIndex].key;
    if (!id) return;
    wx.showModal({ title: '删除记录？', content: `${collection} / ${id}`, success: async r => {
      if (!r.confirm) return;
      try { await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'adminRemove', collection, id } }); this.setData({ editor: '', form: {}, currentId: '' }); this.loadRows(); }
      catch (e) { wx.showToast({ title: '删除失败', icon: 'none' }); }
    } });
  },
  upload() {
    if (!this.data.ready || this.data.uploading) return;
    const collection = TYPES[this.data.typeIndex].key;
    const kind = collection === 'lessons' ? 'video' : 'image';
    wx.chooseMedia({ count: 1, mediaType: [kind], sourceType: ['album'], success: async result => {
      const file = result.tempFiles[0];
      const fileLabel = file.name || (file.tempFilePath || '').split(/[\\\\/]/).pop() || (kind === 'video' ? '视频文件' : '封面图');
      if (kind === 'video' && file.size > 100 * 1024 * 1024) return wx.showToast({ title: '单文件限 100MB；大视频请用控制台上传', icon: 'none' });
      this.setData({ uploading: true });
      try {
        const ext = kind === 'video' ? 'mp4' : 'jpg';
        const cloudPath = `admin-media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const uploaded = await wx.cloud.uploadFile({ cloudPath, filePath: file.tempFilePath });
        const record = this.data.editor ? JSON.parse(this.data.editor) : { ...TEMPLATES[collection] };
        record[kind === 'video' ? 'videoFileId' : 'coverFileId'] = uploaded.fileID;
        if (kind === 'video' && file.duration) record.duration = Math.ceil(file.duration);
        this.setData({ form: record, editor: JSON.stringify(record, null, 2) });
        this.setData({ uploadStatus: `${fileLabel}上传成功` });
        wx.showToast({ title: '上传完成，请点保存' });
      } catch (e) { wx.showModal({ title: '上传失败', content: '请检查云存储管理员写入规则及网络。' + String(e.message || ''), showCancel: false }); }
      finally { this.setData({ uploading: false }); }
    } });
  },
  uploadArticleImage() {
    if (!this.data.ready || this.data.uploading || this.saving || this.articleEditorLoading || !this.articleEditorCtx) return;
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album'], success: async result => {
      this.setData({ uploading: true });
      try {
        const file = result.tempFiles[0], fileLabel = file.name || (file.tempFilePath || '').split(/[\\\\/]/).pop() || '图片';
        const uploaded = await wx.cloud.uploadFile({ cloudPath: `admin-media/articles/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`, filePath: file.tempFilePath });
        const map = await resolveMediaFiles([uploaded.fileID], { preferRemote: true }), src = map[uploaded.fileID];
        if (!src) throw new Error('无法读取已上传图片');
        // Register the permanent identity before the editor can emit HTML input.
        this.setData({ articleImageMap: { ...(this.data.articleImageMap || {}), [src]: uploaded.fileID } });
        await new Promise((resolve, reject) => this.articleEditorCtx.insertImage({ src, width: '100%', success: resolve, fail: reject }));
        const contents = await new Promise((resolve, reject) => this.articleEditorCtx.getContents({ success: resolve, fail: reject }));
        this.setData({ form: { ...this.data.form, content: contents.html || '' }, uploadStatus: `${fileLabel}上传成功` });
      } catch (_) { wx.showToast({ title: '图片插入失败，请重试', icon: 'none' }); }
      finally { this.setData({ uploading: false }); }
    } });
  },
  uploadCover() {
    if (!this.data.ready || this.data.uploading) return;
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album'], success: async result => {
      this.setData({ uploading: true });
      try { const file = result.tempFiles[0]; const fileLabel = file.name || (file.tempFilePath || '').split(/[\\\\/]/).pop() || '视频封面'; const uploaded = await wx.cloud.uploadFile({ cloudPath: `admin-media/covers/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`, filePath: file.tempFilePath }); const record = this.data.editor ? JSON.parse(this.data.editor) : { ...TEMPLATES.lessons }; record.coverFileId = uploaded.fileID; this.setData({ form: record, editor: JSON.stringify(record, null, 2), uploadStatus: `${fileLabel}上传成功` }); wx.showToast({ title: '封面上传完成，请点保存' }); } catch (_) { wx.showToast({ title: '封面上传失败', icon: 'none' }); }
      finally { this.setData({ uploading: false }); }
    } });
  }
});
