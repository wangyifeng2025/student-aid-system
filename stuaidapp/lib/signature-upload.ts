import * as FileSystem from 'expo-file-system';

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

/** 从附件列表回填两张手写图。 */
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

/** 将本地手写 data URL 同步为附件（同名先删后传）。空串跳过。 */
export async function syncSignatureAttachments(
  recognitionId: number,
  commitmentDataUrl: string,
  signatureDataUrl: string,
): Promise<void> {
  const items = await recognitionApi.listAttachments(recognitionId);
  const uploads: { dataUrl: string; fileName: string }[] = [];
  if (commitmentDataUrl.startsWith('data:')) {
    uploads.push({ dataUrl: commitmentDataUrl, fileName: COMMITMENT_HANDWRITING_FILE });
  }
  if (signatureDataUrl.startsWith('data:')) {
    uploads.push({ dataUrl: signatureDataUrl, fileName: STUDENT_SIGNATURE_FILE });
  }
  for (const u of uploads) {
    const old = items.filter((a) => a.file_name === u.fileName);
    for (const a of old) {
      await attachmentApi.remove(a.id);
    }
    const uri = await dataUrlToCacheFile(u.dataUrl, u.fileName);
    await recognitionApi.uploadAttachment(recognitionId, uri, u.fileName, 'image/png');
  }
}
