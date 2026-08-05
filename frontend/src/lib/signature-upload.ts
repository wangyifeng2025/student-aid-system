import { attachmentApi, recognitionApi } from "@/lib/api";
import {
  COMMITMENT_HANDWRITING_FILE,
  STUDENT_SIGNATURE_FILE,
} from "@/lib/signature";

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, raw] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(meta)?.[1] || "image/png";
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 从附件列表回填两张手写图（若存在）。 */
export async function loadSignatureDataUrls(recognitionId: number): Promise<{
  commitment: string;
  signature: string;
}> {
  const items = await recognitionApi.listAttachments(recognitionId);
  let commitment = "";
  let signature = "";
  for (const a of items) {
    if (a.file_name === COMMITMENT_HANDWRITING_FILE) {
      commitment = await blobToDataUrl(await attachmentApi.fetchBlob(a.id));
    } else if (a.file_name === STUDENT_SIGNATURE_FILE) {
      signature = await blobToDataUrl(await attachmentApi.fetchBlob(a.id));
    }
  }
  return { commitment, signature };
}

/**
 * 将本地手写 data URL 同步为附件：同名旧文件先删再传。
 * 传入空串表示跳过该项（保留服务端已有文件）。
 */
export async function syncSignatureAttachments(
  recognitionId: number,
  commitmentDataUrl: string,
  signatureDataUrl: string,
): Promise<void> {
  const items = await recognitionApi.listAttachments(recognitionId);
  const uploads: { dataUrl: string; fileName: string }[] = [];
  if (commitmentDataUrl.startsWith("data:")) {
    uploads.push({ dataUrl: commitmentDataUrl, fileName: COMMITMENT_HANDWRITING_FILE });
  }
  if (signatureDataUrl.startsWith("data:")) {
    uploads.push({ dataUrl: signatureDataUrl, fileName: STUDENT_SIGNATURE_FILE });
  }
  for (const u of uploads) {
    const old = items.filter((a) => a.file_name === u.fileName);
    for (const a of old) {
      await attachmentApi.remove(a.id);
    }
    await recognitionApi.uploadAttachment(recognitionId, dataUrlToFile(u.dataUrl, u.fileName));
  }
}
