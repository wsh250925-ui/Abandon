const quizSets = [
  { _id: 'demo_cpr', title: '心肺复苏基础测试', description: '成人 CPR 与 AED 基础知识', published: true, order: 1 },
  { _id: 'demo_firstaid', title: '日常急救基础测试', description: '气道异物、出血、烧烫伤与中暑', published: true, order: 2 }
];
const raw = [
  ['demo_cpr', '发现有人倒地，施救前首先应做什么？', ['判断现场是否安全', '立即喂水', '马上搬动伤者', '拍照记录'], 0, '先确认现场安全，再判断反应并呼救。'],
  ['demo_cpr', '判断成人是否有正常呼吸，通常不应超过多久？', ['3 秒', '10 秒', '30 秒', '1 分钟'], 1, '呼吸判断应尽快完成，通常不超过 10 秒。'],
  ['demo_cpr', '成人胸外按压的推荐频率是？', ['每分钟 60–80 次', '每分钟 80–100 次', '每分钟 100–120 次', '每分钟 140–160 次'], 2, '成人 CPR 胸外按压频率通常为每分钟 100–120 次。'],
  ['demo_cpr', '成人胸外按压深度通常为？', ['约 1 厘米', '约 2–3 厘米', '约 5–6 厘米', '超过 8 厘米'], 2, '成人按压深度一般为 5–6 厘米。'],
  ['demo_cpr', '拿到 AED 后，正确做法是？', ['不看提示立即放电', '开启设备并按语音提示操作', '只贴一片电极片', '关闭设备继续等待'], 1, '开启 AED，依照语音和图示提示操作，并在分析或放电时避免接触患者。'],
  ['demo_firstaid', '清醒成人发生严重气道异物梗阻，适宜采取什么急救方法？', ['腹部冲击法', '立即喂水', '让其平躺睡觉', '用手盲目掏取'], 0, '严重梗阻应立即求助并按适用急救流程施救；特殊人群方法不同。'],
  ['demo_firstaid', '有人触电时，施救者第一步应做什么？', ['徒手拉开伤者', '先切断电源并确保安全', '用水冲洗', '立即喂药'], 1, '先切断电源或使用绝缘物隔离电源，避免施救者触电。'],
  ['demo_firstaid', '小面积热烧伤后，首先应采取哪项措施？', ['涂牙膏', '立即用流动凉水冷却', '刺破水疱', '直接贴胶布'], 1, '尽快用流动凉水冷却，不随意涂抹偏方或挑破水疱。'],
  ['demo_firstaid', '外伤出血时，通常优先采取哪种止血方法？', ['直接压迫伤口', '让伤者快速跑动', '反复揭开敷料查看', '立即涂酒精'], 0, '在确保安全并采取防护的前提下，对出血处持续直接压迫。'],
  ['demo_firstaid', '怀疑热射病时，以下哪项更合适？', ['继续在太阳下运动', '尽快转移至阴凉处、呼救并降温', '只喝热水观察', '厚衣物保暖'], 1, '热射病可能危及生命，应立即呼叫急救并尽快降温。']
];
const questions = raw.map((x, i) => ({ _id: `demo_q${i + 1}`, setId: x[0], stem: x[1], options: x[2], answer: x[3], explanation: x[4], order: i % 5 + 1, published: true }));
const courses = [{ _id: 'demo_course', title: '急救知识入门', description: '用于功能联调的演示课程', badge: '实操演练', coverFileId: '', published: true, order: 1 }];
const lessons = [{ _id: 'demo_lesson', courseId: 'demo_course', title: '演示视频：认识 AED', subtitle: '认识 AED 与现场操作要点', description: '约 8 秒的测试画面，仅供播放与进度功能联调，不是教学内容。', videoFileId: '', duration: 8, coverFileId: '', published: true, order: 1 }];
module.exports = { quizSets, questions, courses, lessons };
