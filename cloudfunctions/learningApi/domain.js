function mergeIntervals(intervals) {
  const sorted = intervals.filter(x => Array.isArray(x) && x.length === 2 && Number.isFinite(x[0]) && Number.isFinite(x[1]) && x[1] > x[0]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
function totalSeconds(intervals) {
  return Math.floor(mergeIntervals(intervals).reduce((sum, x) => sum + x[1] - x[0], 0));
}
function grade(questions, answers) {
  const detail = questions.map((q, i) => ({ questionId: q._id, correct: q.answer === answers[i], answer: q.answer, explanation: q.explanation || '' }));
  const correct = detail.filter(x => x.correct).length;
  return { correct, total: questions.length, score: correct * 10, detail };
}
module.exports = { mergeIntervals, totalSeconds, grade };
