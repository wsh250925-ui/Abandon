const test = require('node:test');
const assert = require('node:assert/strict');
const { permanentImageRef, persistImages, articleBlocks } = require('../miniprogram/utils/article-content');
const legacy = 'https://636c-cloud1-3gallbdh0047145a-1422675813.tcb.qcloud.la/admin-media/articles/1790045658425-isjscmiartk.jpg?sign=9f79e8cfe77870bf5d55a0b851b7e3ae&t=1790045660';
const fileID = 'cloud://cloud1-3gallbdh0047145a.636c-cloud1-3gallbdh0047145a-1422675813/admin-media/articles/1790045658425-isjscmiartk.jpg';
test('本次 403 地址与 HTML 转义地址恢复为相同永久 FileID', () => {
  assert.equal(permanentImageRef(legacy), fileID);
  assert.equal(permanentImageRef(legacy.replace('&t=', '&amp;t=')), fileID);
  assert.equal(permanentImageRef(fileID), fileID);
  assert.equal(permanentImageRef('https://example.com/image.jpg?sign=x'), 'https://example.com/image.jpg?sign=x');
  assert.equal(permanentImageRef(legacy.replace('636c-cloud1', 'other-cloud1')), legacy.replace('636c-cloud1', 'other-cloud1'));
});
test('保存只重写图片 src 不改变文本实体 包含编辑器映射与旧链接', () => {
  const html = `<p>说明 &amp; 注意</p><img src='${legacy.replace('&t=', '&amp;t=')}'><img src="https://new.example/a?x=1&amp;y=2">`;
  const saved = persistImages(html, { 'https://new.example/a?x=1&y=2': 'cloud://env.bucket/new.jpg' });
  assert.ok(saved.includes('说明 &amp; 注意'));
  assert.ok(saved.includes(`src="${fileID}"`));
  assert.ok(saved.includes('src="cloud://env.bucket/new.jpg"'));
  assert.ok(!saved.includes('sign='));
});
test('多图按原顺序拆分且跨图片的嵌套段落保持平衡', () => {
  const blocks = articleBlocks(`<p><strong>之前<img src="${legacy}">之后</strong></p><p><img src='${fileID}'></p><p>末尾</p>`);
  assert.deepEqual(blocks.map(x => x.type), ['text', 'image', 'text', 'image', 'text']);
  assert.equal(blocks[0].html, '<p><strong>之前</strong></p>');
  assert.equal(blocks[2].html, '<p><strong>之后</strong></p>');
  assert.equal(blocks[1].ref, fileID);
  assert.equal(blocks[1].src, '');
});
test('图文阅读不下载过期 URL 原生图片得到新临时文件', async () => {
  let page;
  global.Page = value => { page = value; };
  const downloads = [];
  global.wx = { cloud: { callFunction: async () => ({ result: { title: '测试', content: `<p>内容<img src="${legacy}"></p>` } }), downloadFile: async ({ fileID: id }) => { downloads.push(id); return { tempFilePath: 'wxfile://new-picture.jpg' }; } } };
  delete require.cache[require.resolve('../miniprogram/pages/article/index')];
  require('../miniprogram/pages/article/index');
  page.data = { ...page.data };
  page.setData = function (patch) { Object.assign(this.data, patch); };
  await page.onLoad({ id: 'demo' });
  assert.deepEqual(downloads, [fileID]);
  assert.equal(page.data.blocks.find(x => x.type === 'image').src, 'wxfile://new-picture.jpg');
  assert.equal(page.data.loading, false);
  delete global.Page; delete global.wx;
});
test('云接口失败时不把过期地址塞回渲染层', async () => {
  global.wx = { cloud: { downloadFile: async () => { throw new Error('offline'); }, getTempFileURL: async () => ({ fileList: [{ fileID, status: -1, tempFileURL: legacy }] }) } };
  const { resolveMediaFiles } = require('../miniprogram/utils/media');
  assert.deepEqual(await resolveMediaFiles([fileID]), {});
  delete global.wx;
});
