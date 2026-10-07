const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeIntervals, totalSeconds, grade } = require('../cloudfunctions/learningApi/domain');
const seed = require('../cloudfunctions/learningApi/seed');

test('两套演示题组各有五道选择题', () => {
  assert.equal(seed.quizSets.length, 2);
  assert.equal(seed.questions.length, 10);
  for (const set of seed.quizSets) assert.equal(seed.questions.filter(x => x.setId === set._id).length, 5);
  for (const q of seed.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length);
});

test('重复观看与重叠区间只累计一次', () => {
  assert.deepEqual(mergeIntervals([[5, 10], [0, 6], [3, 8], [12, 14]]), [[0, 10], [12, 14]]);
  assert.equal(totalSeconds([[0, 6], [2, 6], [5, 9]]), 9);
});

test('无效或倒序区间不计时', () => {
  assert.equal(totalSeconds([[5, 4], [0, 2], [NaN, 10]]), 2);
});

test('选择题由服务端评分并返回解析', () => {
  const questions = seed.questions.slice(0, 5);
  const answers = questions.map(q => q.answer);
  answers[0] = (answers[0] + 1) % questions[0].options.length;
  const result = grade(questions, answers);
  assert.equal(result.correct, 4);
  assert.equal(result.score, 40);
  assert.equal(result.detail[0].correct, false);
  assert.ok(result.detail[0].explanation);
});
