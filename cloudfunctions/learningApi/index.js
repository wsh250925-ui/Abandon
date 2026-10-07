const cloud = require('wx-server-sdk');
const { mergeIntervals, totalSeconds, grade } = require('./domain');
const seed = require('./seed');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const COLLECTIONS = ['users', 'courses', 'lessons', 'articles', 'quizSets', 'questions', 'quizAttempts', 'quizBest', 'lessonProgress', 'dailyStudy', 'adminAuditLogs', 'settings'];
const EDITABLE = ['users', 'courses', 'lessons', 'articles', 'quizSets', 'questions', 'settings'];
const ALLOWED = {
  users: ['nickname', 'avatarUrl', 'anonymousInRanking', 'disabled'],
  courses: ['title', 'description', 'coverFileId', 'badge', 'published', 'order'],
  lessons: ['courseId', 'title', 'subtitle', 'description', 'videoFileId', 'duration', 'coverFileId', 'published', 'order'],
  articles: ['title', 'summary', 'content', 'coverFileId', 'published', 'order'],
  quizSets: ['title', 'description', 'published', 'order'],
  questions: ['setId', 'stem', 'options', 'answer', 'explanation', 'published', 'order'],
  settings: ['key', 'value']
};
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => Object.prototype.hasOwnProperty.call(obj, k)).map(k => [k, obj[k]]));
// When writing through collection.doc(id), wx-server-sdk owns the _id field.
// Including _id in the data payload makes document.set/update fail with
// "不能更新_id的值". Keep IDs in the path only.
const withoutId = (obj) => { const { _id, ...rest } = obj || {}; return rest; };
const adminIds = () => (process.env.ADMIN_OPENIDS || '').split(',').map(x => x.trim()).filter(Boolean);
function requireAdmin(openid) { if (!adminIds().includes(openid)) throw new Error('无管理员权限。请先在云函数环境变量 ADMIN_OPENIDS 中配置开发者 OpenID。'); }
function safeId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value); }
function chinaDay() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
async function docOrNull(collection, id) { try { const r = await db.collection(collection).doc(id).get(); return r.data || null; } catch (_) { return null; } }
async function audit(openid, action, collection, id) { await db.collection('adminAuditLogs').add({ data: { openid, action, collection, targetId: id, at: db.serverDate() } }); }
async function ensureUser(openid) {
  let user = await docOrNull('users', openid);
  if (!user) {
    user = { _id: openid, nickname: '微信用户', avatarUrl: '', anonymousInRanking: false, disabled: false, createdAt: db.serverDate(), updatedAt: db.serverDate() };
    await db.collection('users').doc(openid).set({ data: withoutId(user) });
  }
  if (user.disabled) throw new Error('账号暂不可用');
  return user;
}
async function bootstrap(openid) {
  requireAdmin(openid);
  const created = [];
  for (const name of COLLECTIONS) {
    try { await db.collection(name).limit(1).get(); }
    catch (_) { await db.createCollection(name); created.push(name); }
  }
  let inserted = 0;
  for (const [name, rows] of Object.entries(seed)) {
    for (const row of rows) {
      const existing = await docOrNull(name, row._id);
      if (!existing) { await db.collection(name).doc(row._id).set({ data: { ...withoutId(row), createdAt: db.serverDate(), updatedAt: db.serverDate() } }); inserted++; }
      else if (name === 'courses' && row.badge && !existing.badge) await db.collection(name).doc(row._id).update({ data: { badge: row.badge, updatedAt: db.serverDate() } });
      else if (name === 'lessons' && row.subtitle && !existing.subtitle) await db.collection(name).doc(row._id).update({ data: { subtitle: row.subtitle, updatedAt: db.serverDate() } });
      else if (name === 'questions' && row.explanation && !existing.explanation) await db.collection(name).doc(row._id).update({ data: { explanation: row.explanation, updatedAt: db.serverDate() } });
    }
  }
  await audit(openid, 'bootstrap', '', '');
  return { created, inserted, collections: COLLECTIONS };
}
async function catalog() {
  const names = ['courses', 'lessons', 'articles', 'quizSets'];
  const result = {};
  for (const name of names) {
    const rows = await db.collection(name).where({ published: true }).limit(100).get();
    result[name] = rows.data.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  const lessons = result.lessons || [];
  result.courses = (result.courses || []).map(course => ({ ...course, totalDuration: lessons.filter(x => x.courseId === course._id).reduce((sum, x) => sum + Number(x.duration || 0), 0) }));
  return result;
}
async function touchStudyDay(openid) {
  const day = chinaDay(), dayId = `${openid}_${day}`;
  const daily = await docOrNull('dailyStudy', dayId);
  await db.collection('dailyStudy').doc(dayId).set({ data: { openid, day, seconds: daily ? Number(daily.seconds || 0) : 0, checkedIn: true, updatedAt: db.serverDate() } });
}
async function dailyQuestion(openid) {
  const rows = await db.collection('questions').where({ published: true }).limit(1000).get();
  if (!rows.data.length) throw new Error('暂无已发布题目');
  const dayNumber = Math.floor(Date.now() / 86400000);
  const q = rows.data[dayNumber % rows.data.length];
  const attempts = await db.collection('quizAttempts').where({ openid, questionId: q._id, quick: true }).limit(1).get();
  const attempt = attempts.data[0];
  const selectedAnswer = attempt && Array.isArray(attempt.answers) ? attempt.answers[0] : -1;
  const answered = Number.isInteger(selectedAnswer);
  return { _id: q._id, setId: q.setId, stem: q.stem, options: q.options, explanation: q.explanation || '', answered, selectedAnswer, answer: answered ? q.answer : undefined, correct: answered ? selectedAnswer === q.answer : false };
}
async function submitQuick(openid, event) {
  const q = await docOrNull('questions', event.questionId);
  if (!q || !q.published || !Number.isInteger(event.answer)) throw new Error('题目或答案无效');
  const correct = q.answer === event.answer;
  await db.collection('quizAttempts').add({ data: { openid, setId: q.setId, questionId: q._id, answers: [event.answer], score: correct ? 10 : 0, correct: correct ? 1 : 0, total: 1, at: db.serverDate(), quick: true } });
  await touchStudyDay(openid);
  return { correct, answer: q.answer, explanation: q.explanation || '' };
}
async function adminSave(openid, event) {
  requireAdmin(openid);
  const { collection, record } = event;
  if (!EDITABLE.includes(collection) || !record || typeof record !== 'object') throw new Error('无效的数据类型');
  const id = record._id || `${collection}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (!safeId(id)) throw new Error('记录 ID 只能包含英文、数字、下划线或连字符');
  if (collection === 'users' && !(await docOrNull('users', id))) throw new Error('只能编辑已登录用户');
  const data = pick(record, ALLOWED[collection]);
  if (collection === 'questions') {
    if (!safeId(data.setId) || !Array.isArray(data.options) || data.options.length < 2 || data.options.length > 6 || !data.options.every(x => typeof x === 'string' && x.trim()) || !Number.isInteger(data.answer) || data.answer < 0 || data.answer >= data.options.length) throw new Error('题目需要题库 ID、2–6 个选项及有效答案序号');
  }
  if (collection === 'articles' && typeof data.content === 'string' && data.content.length > 50000) throw new Error('图文正文不能超过 5 万字');
  if (collection === 'lessons' && data.videoFileId && !/^cloud:\/\//.test(data.videoFileId)) throw new Error('视频文件需为云存储 FileID');
  const old = await docOrNull(collection, id);
  if (old) await db.collection(collection).doc(id).update({ data: { ...data, updatedAt: db.serverDate() } });
  else await db.collection(collection).doc(id).set({ data: { ...data, createdAt: db.serverDate(), updatedAt: db.serverDate() } });
  await audit(openid, old ? 'update' : 'create', collection, id);
  return { id };
}
async function submitQuiz(openid, event) {
  const setId = event.setId;
  if (!safeId(setId) || !Array.isArray(event.answers)) throw new Error('答题数据无效');
  const set = await docOrNull('quizSets', setId);
  if (!set || !set.published) throw new Error('题库未发布');
  const rows = await db.collection('questions').where({ setId, published: true }).limit(100).get();
  rows.data.sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!rows.data.length || event.answers.length !== rows.data.length || !event.answers.every(Number.isInteger)) throw new Error('请完成所有题目');
  const result = grade(rows.data, event.answers);
  await db.collection('quizAttempts').add({ data: { openid, setId, answers: event.answers, score: result.score, correct: result.correct, total: result.total, at: db.serverDate() } });
  await touchStudyDay(openid);
  const bestId = `${openid}_${setId}`;
  const best = await docOrNull('quizBest', bestId);
  const legacyBest = best && best.score > rows.data.length * 10 ? Math.round(Number(best.score) * rows.data.length / 100) * 10 : Number(best && best.score || 0);
  if (!best || result.score > legacyBest || legacyBest !== Number(best.score)) await db.collection('quizBest').doc(bestId).set({ data: { openid, setId, score: Math.max(result.score, legacyBest), updatedAt: db.serverDate() } });
  return result;
}
async function recordWatch(openid, event) {
  const lessonId = event.lessonId;
  const from = Number(event.from), to = Number(event.to), elapsed = Number(event.elapsed);
  if (!safeId(lessonId) || !Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(elapsed) || from < 0 || to <= from || to - from > 30 || to - from > elapsed + 1 || elapsed > 35) throw new Error('播放记录无效');
  const lesson = await docOrNull('lessons', lessonId);
  if (!lesson || !lesson.published || to > Number(lesson.duration) + 1) throw new Error('课程不存在或播放区间无效');
  const id = `${openid}_${lessonId}`;
  const old = await docOrNull('lessonProgress', id);
  const intervals = mergeIntervals([...(old ? old.intervals : []), [from, Math.min(to, Number(lesson.duration))]]);
  const added = Math.max(0, totalSeconds(intervals) - totalSeconds(old ? old.intervals : []));
  await db.collection('lessonProgress').doc(id).set({ data: { openid, lessonId, intervals, uniqueSeconds: totalSeconds(intervals), updatedAt: db.serverDate() } });
  await touchStudyDay(openid);
  if (added) {
    const day = chinaDay(), dayId = `${openid}_${day}`;
    const daily = await docOrNull('dailyStudy', dayId);
    await db.collection('dailyStudy').doc(dayId).set({ data: { openid, day, seconds: (daily ? daily.seconds : 0) + added, checkedIn: true, updatedAt: db.serverDate() } });
  }
  return { uniqueSeconds: totalSeconds(intervals), added };
}
async function allRows(collection, filter) {
  const rows = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await db.collection(collection).where(filter).skip(offset).limit(100).get();
    rows.push(...page.data);
    if (page.data.length < 100) break;
  }
  return rows;
}
function periodStart(period) {
  const now = new Date(Date.now() + 8 * 3600000);
  if (period === 'day') return now.toISOString().slice(0, 10);
  if (period === 'week') { const day = (now.getUTCDay() + 6) % 7; now.setUTCDate(now.getUTCDate() - day); return now.toISOString().slice(0, 10); }
  if (period === 'month') return now.toISOString().slice(0, 7) + '-01';
  return '0000-01-01';
}
function normalizedQuizScore(row, questionCounts) {
  const score = Number(row && row.score || 0);
  const total = Number(row && row.total || questionCounts.get(row && row.setId) || 0);
  if (!total || score <= total * 10) return score;
  return Math.round(score * total / 100) * 10;
}
async function ranking(event) {
  const period = ['day', 'week', 'month', 'total'].includes(event.period) ? event.period : 'week';
  const metric = event.metric === 'score' ? 'score' : 'time';
  const totals = new Map();
  if (metric === 'time') {
    const rows = await allRows('dailyStudy', { day: db.command.gte(periodStart(period)) });
    for (const x of rows) totals.set(x.openid, (totals.get(x.openid) || 0) + (x.seconds || 0));
  } else {
    const questionRows = await allRows('questions', { published: true });
    const questionCounts = new Map();
    for (const q of questionRows) questionCounts.set(q.setId, (questionCounts.get(q.setId) || 0) + 1);
    const rows = period === 'total' ? await allRows('quizBest', {}) : await allRows('quizAttempts', { at: db.command.gte(new Date(periodStart(period) + 'T00:00:00+08:00')) });
    const perUser = new Map();
    for (const x of rows) {
      const scores = perUser.get(x.openid) || new Map();
      scores.set(x.setId, Math.max(scores.get(x.setId) || 0, normalizedQuizScore(x, questionCounts)));
      perUser.set(x.openid, scores);
    }
    for (const [openid, scores] of perUser) totals.set(openid, [...scores.values()].reduce((sum, score) => sum + score, 0));
  }
  const sorted = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 50);
  return Promise.all(sorted.map(async ([openid, value], i) => {
    const user = await docOrNull('users', openid);
    return { rank: i + 1, nickname: user && !user.anonymousInRanking ? (user.nickname || '微信用户') : '匿名学习者', avatarUrl: user && !user.anonymousInRanking ? (user.avatarUrl || '') : '', value };
  }));
}
exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) throw new Error('未获得微信身份');
  const action = event.action;
  if (action === 'identity') return { openid, admin: adminIds().includes(openid), configured: adminIds().length > 0 };
  if (action === 'bootstrap') return bootstrap(openid);
  if (action === 'adminList') { requireAdmin(openid); if (!COLLECTIONS.includes(event.collection)) throw new Error('集合不允许管理'); return (await db.collection(event.collection).limit(100).get()).data; }
  if (action === 'adminSave') return adminSave(openid, event);
  if (action === 'adminRemove') { requireAdmin(openid); if (!EDITABLE.includes(event.collection) || !safeId(event.id) || event.collection === 'users') throw new Error('不能删除该记录'); await db.collection(event.collection).doc(event.id).remove(); await audit(openid, 'remove', event.collection, event.id); return { ok: true }; }
  if (action === 'catalog') return catalog();
  if (action === 'dailyQuestion') return dailyQuestion(openid);
  if (action === 'submitQuick') return submitQuick(openid, event);
  if (action === 'ranking') return ranking(event);
  const user = await ensureUser(openid);
  if (action === 'profile') {
    const progress = (await db.collection('lessonProgress').where({ openid }).limit(100).get()).data;
    const daily = (await db.collection('dailyStudy').where({ openid }).limit(100).get()).data;
    const best = (await db.collection('quizBest').where({ openid }).limit(100).get()).data;
    return { user, progress, daily, best };
  }
  if (action === 'saveProfile') { const data = pick(event, ['nickname', 'anonymousInRanking']); if (data.nickname) data.nickname = String(data.nickname).slice(0, 24); if ('anonymousInRanking' in data) data.anonymousInRanking = !!data.anonymousInRanking; await db.collection('users').doc(openid).update({ data: { ...data, updatedAt: db.serverDate() } }); return { ok: true }; }
  if (action === 'uploadAvatar') {
    const base64 = event.base64;
    if (typeof base64 !== 'string' || base64.length > 400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('头像文件无效或超过 300KB');
    const uploaded = await cloud.uploadFile({ cloudPath: `avatars/${openid}-${Date.now()}.jpg`, fileContent: Buffer.from(base64, 'base64') });
    await db.collection('users').doc(openid).update({ data: { avatarUrl: uploaded.fileID, updatedAt: db.serverDate() } });
    return { fileID: uploaded.fileID };
  }
  if (action === 'getQuiz') { const set = await docOrNull('quizSets', event.setId); if (!set || !set.published) throw new Error('题库未发布'); const rows = (await db.collection('questions').where({ setId: event.setId, published: true }).limit(100).get()).data.sort((a, b) => (a.order || 0) - (b.order || 0)); return { set, questions: rows.map(({ _id, stem, options }) => ({ _id, stem, options })) }; }
  if (action === 'getLesson') {
    const lesson = await docOrNull('lessons', event.id);
    if (!lesson || !lesson.published) throw new Error('课程未发布');
    const course = lesson.courseId ? await docOrNull('courses', lesson.courseId) : null;
    const lessonRows = course && course.published ? (await db.collection('lessons').where({ courseId: course._id, published: true }).limit(100).get()).data.sort((a, b) => (a.order || 0) - (b.order || 0)) : [lesson];
    const progress = await docOrNull('lessonProgress', `${openid}_${event.id}`);
    const allProgress = lessonRows.length ? (await db.collection('lessonProgress').where({ openid }).limit(100).get()).data : [];
    return { lesson, currentProgress: progress, course: course && course.published ? course : null, lessons: lessonRows, progresses: allProgress };
  }
  if (action === 'getArticle') { const article = await docOrNull('articles', event.id); if (!article || !article.published) throw new Error('图文未发布'); return article; }
  if (action === 'submitQuiz') return submitQuiz(openid, event);
  if (action === 'recordWatch') return recordWatch(openid, event);
  throw new Error('未知操作');
};
