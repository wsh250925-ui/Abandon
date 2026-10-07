const { resolveMediaFile, resolveMediaFiles } = require('../../utils/media');
const { articleBlocks, permanentImageRef } = require('../../utils/article-content');
Page({
  data: { article: null, coverUrl: '', blocks: [], loading: true, error: '' },
  async onLoad(options) {
    this.alive = true;
    try {
      const r = await wx.cloud.callFunction({ name: 'learningApi', data: { action: 'getArticle', id: options.id } });
      const article = r.result;
      if (!article || typeof article.content !== 'string') throw new Error('INVALID_ARTICLE');
      const blocks = articleBlocks(article.content);
      if (!this.alive) return;
      // Render text immediately; original expired image URLs never reach the renderer.
      this.setData({ article, blocks, loading: false });
      const refs = blocks.filter(x => x.type === 'image').map(x => x.ref);
      const coverRef = permanentImageRef(article.coverFileId);
      const map = await resolveMediaFiles([...refs, coverRef]);
      if (!this.alive) return;
      this.setData({ coverUrl: map[coverRef] || '', blocks: blocks.map(x => x.type === 'image' ? { ...x, src: map[x.ref] || '', state: map[x.ref] ? 'loading' : 'error' } : x) });
    } catch (_) { if (this.alive) this.setData({ loading: false, error: '图文加载失败，请返回后重试。' }); }
  },
  onUnload() { this.alive = false; },
  onImageLoad(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.alive && this.data.blocks[index]) this.setData({ [`blocks[${index}].state`]: 'ready' });
  },
  async onImageError(e) {
    const index = Number(e.currentTarget.dataset.index), block = this.data.blocks[index];
    if (!block || block.retries >= 1) { if (block && this.alive) this.setData({ [`blocks[${index}].state`]: 'error' }); return; }
    this.setData({ [`blocks[${index}].retries`]: block.retries + 1 });
    const src = await resolveMediaFile(block.ref);
    if (!this.alive) return;
    if (src && src !== block.src) this.setData({ [`blocks[${index}].src`]: src, [`blocks[${index}].state`]: 'loading' });
    else this.setData({ [`blocks[${index}].state`]: 'error' });
  },
  async retryImage(e) {
    const index = Number(e.currentTarget.dataset.index), block = this.data.blocks[index];
    if (!block || block.state !== 'error') return;
    this.setData({ [`blocks[${index}].state`]: 'loading', [`blocks[${index}].src`]: '' });
    const src = await resolveMediaFile(block.ref);
    if (this.alive) this.setData({ [`blocks[${index}].src`]: src, [`blocks[${index}].state`]: src ? 'loading' : 'error', [`blocks[${index}].retries`]: 0 });
  },
  previewImage(e) {
    const index = Number(e.currentTarget.dataset.index), block = this.data.blocks[index];
    if (block && block.state === 'ready') wx.previewImage({ current: block.src, urls: this.data.blocks.filter(x => x.type === 'image' && x.state === 'ready').map(x => x.src) });
  }
});
