import * as FileSystem from 'expo-file-system/legacy';

import { attachmentApi, recognitionApi } from '@/lib/api';
import {
  COMMITMENT_HANDWRITING_FILE,
  STUDENT_SIGNATURE_FILE,
} from '@/constants/signature';

async function dataUrlToCacheFile(dataUrl: string, fileName: string): Promise<string> {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

/** 从附件列表回填签字图（历史承诺手写图一并返回，供详情兼容展示）。 */
export async function loadSignatureDataUrls(recognitionId: number): Promise<{
  commitment: string;
  signature: string;
}> {
  const items = await recognitionApi.listAttachments(recognitionId);
  let commitment = '';
  let signature = '';
  for (const a of items) {
    if (a.file_name === COMMITMENT_HANDWRITING_FILE) {
      commitment = await attachmentApi.fetchDataUrl(a.id);
    } else if (a.file_name === STUDENT_SIGNATURE_FILE) {
      signature = await attachmentApi.fetchDataUrl(a.id);
    }
  }
  return { commitment, signature };
}

/** 将本地签字 data URL 同步为附件（同名先删后传）。空串跳过。 */
export async function syncSignatureAttachments(
  recognitionId: number,
  signatureDataUrl: string,
): Promise<void> {
  if (!signatureDataUrl.startsWith('data:')) return;

  const items = await recognitionApi.listAttachments(recognitionId);
  const old = items.filter((a) => a.file_name === STUDENT_SIGNATURE_FILE);
  for (const a of old) {
    await attachmentApi.remove(a.id);
  }
  const uri = await dataUrlToCacheFile(signatureDataUrl, STUDENT_SIGNATURE_FILE);
  await recognitionApi.uploadAttachment(recognitionId, uri, STUDENT_SIGNATURE_FILE, 'image/png');
}
