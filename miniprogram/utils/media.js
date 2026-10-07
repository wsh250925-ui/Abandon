function normalizeRef(value) { return String(value || '').replace(/&amp;/g, '&'); }
function isCloudFileId(value) { return /^cloud:\/\//.test(normalizeRef(value)); }
function isRemoteUrl(value) { return /^https?:\/\//.test(normalizeRef(value)); }

async function resolveMediaFiles(fileIds, options) {
  options = options || {};
  const unique = [...new Set((fileIds || []).map(normalizeRef).filter(value => isCloudFileId(value) || isRemoteUrl(value)))];
  const map = {};
  if (options.preferRemote) {
    const cloudRefs = unique.filter(isCloudFileId);
    if (cloudRefs.length) {
      try {
        const result = await wx.cloud.getTempFileURL({ fileList: cloudRefs });
        (result.fileList || []).forEach(item => { if ((item.status === undefined || Number(item.status) === 0) && item.tempFileURL) map[item.fileID] = item.tempFileURL; });
      } catch (_) { /* 后续改用下载兜底 */ }
    }
  }
  // 下载到本地临时文件，避免渲染层直接访问带签名 URL 时偶发连接中断。
  for (let i = 0; i < unique.length; i += 4) {
    const entries = await Promise.all(unique.slice(i, i + 4).filter(fileID => !map[fileID]).map(async fileID => {
      try {
        const result = isCloudFileId(fileID) ? await wx.cloud.downloadFile({ fileID }) : await wx.downloadFile({ url: fileID });
        return [fileID, result.statusCode && result.statusCode !== 200 ? '' : (result.tempFilePath || '')];
      }
      catch (_) { return [fileID, '']; }
    }));
    entries.forEach(([fileID, path]) => { if (path) map[fileID] = path; });
  }
  const unresolved = unique.filter(fileID => !map[fileID] && isCloudFileId(fileID));
  if (unresolved.length) {
    try {
      const result = await wx.cloud.getTempFileURL({ fileList: unresolved });
      (result.fileList || []).forEach(item => { if ((item.status === undefined || Number(item.status) === 0) && item.tempFileURL) map[item.fileID] = item.tempFileURL; });
    } catch (_) { /* 保持空值，页面会使用默认图 */ }
  }
  return map;
}

async function resolveMediaFile(fileID, options) { const ref = normalizeRef(fileID); return (await resolveMediaFiles([ref], options))[ref] || ''; }

module.exports = { isCloudFileId, resolveMediaFile, resolveMediaFiles };
