// Recover legacy signed URLs only for this project's storage bucket.
const STORAGE = { env: 'cloud1-3gallbdh0047145a', bucket: '636c-cloud1-3gallbdh0047145a-1422675813' };
function decodeAttribute(value) {
  return String(value || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'");
}
function permanentImageRef(value) {
  const ref = decodeAttribute(value).trim();
  const prefix = `https://${STORAGE.bucket}.tcb.qcloud.la/`;
  if (ref.startsWith(prefix)) {
    // Strip expired signatures; never request the old URL again.
    const path = ref.slice(prefix.length).split(/[?#]/)[0];
    if (/^admin-media\/(articles|covers)\//.test(path) && !/(?:^|\/)\.\.(?:\/|$)/.test(path)) return `cloud://${STORAGE.env}.${STORAGE.bucket}/${path}`;
  }
  return ref;
}
function imageSource(tag) {
  const match = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
  return match ? decodeAttribute(match[1] || match[2] || match[3]) : '';
}
function escapeAttribute(value) { return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function rewriteImages(html, resolve) {
  return String(html || '').replace(/<img\b[^>]*>/gi, tag => {
    const src = imageSource(tag); if (!src) return tag;
    return tag.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `src="${escapeAttribute(resolve(src))}"`);
  });
}
function persistImages(html, map) {
  const refs = {};
  Object.keys(map || {}).forEach(key => { refs[decodeAttribute(key)] = map[key]; });
  return rewriteImages(html, src => permanentImageRef(refs[src] || src));
}
// Keep paragraph formatting around images while rendering pictures as native <image>.
function articleBlocks(html) {
  const source = String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const blocks = [], stack = [];
  let buffer = '';
  function flush() {
    if (buffer.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() || /<(br|hr)\b/i.test(buffer)) {
      const balanced = buffer + stack.slice().reverse().map(x => `</${x.name}>`).join('');
      blocks.push({ type: 'text', html: balanced.replace(/<(p|div)\b[^>]*>\s*<\/\1>/gi, '') });
    }
  }
  const tokens = source.match(/<[^>]+>|[^<]+|</g) || [];
  tokens.forEach(token => {
    if (/^<img\b/i.test(token)) {
      flush();
      const src = imageSource(token);
      if (src) blocks.push({ type: 'image', ref: permanentImageRef(src), src: '', state: 'loading', retries: 0 });
      buffer = stack.map(x => x.tag).join('');
      return;
    }
    buffer += token;
    const open = /^<([a-z][\w-]*)\b/i.exec(token), close = /^<\/([a-z][\w-]*)\s*>/i.exec(token);
    if (open && !/^(br|hr|input|meta|link|source|wbr)$/i.test(open[1]) && !/\/\s*>$/.test(token)) stack.push({ name: open[1], tag: token });
    if (close) { const i = stack.map(x => x.name.toLowerCase()).lastIndexOf(close[1].toLowerCase()); if (i >= 0) stack.splice(i); }
  });
  flush();
  return blocks.map((block, i) => ({ ...block, id: `block_${i}` }));
}
module.exports = { STORAGE, decodeAttribute, permanentImageRef, imageSource, persistImages, rewriteImages, articleBlocks };
