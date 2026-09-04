import { File as ExpoFile } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/** 相册常返回 content:// / ph://；上传前尽量落到 file://。 */
export function ensureFileUri(uri: string): string {
  const trimmed = (uri || '').trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('assets-library://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  return trimmed;
}

function cacheDest(fileName: string): string {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('无法访问本地缓存目录');
  return `${dir}${fileName}`;
}

/** 把任意本地 URI 拷到缓存（content:// 复制失败时改走 base64 读写）。 */
export async function materializeLocalFile(uri: string, destName: string): Promise<string> {
  const dest = cacheDest(destName);
  await FileSystem.deleteAsync(dest, { idempotent: true });
  const from = ensureFileUri(uri);
  try {
    await FileSystem.copyAsync({ from, to: dest });
  } catch {
    const b64 = await FileSystem.readAsStringAsync(from, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(dest, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  return ensureFileUri(dest);
}

/** 拍照/相册统一压成 JPEG，顺带处理 HEIC 与 content://。 */
export async function prepareImageUpload(uri: string): Promise<{ uri: string; name: string; mime: string }> {
  const name = `proof_${Date.now()}.jpg`;
  try {
    const result = await ImageManipulator.manipulateAsync(ensureFileUri(uri), [], {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: ensureFileUri(result.uri), name, mime: 'image/jpeg' };
  } catch {
    const dest = await materializeLocalFile(uri, name);
    return { uri: dest, name, mime: 'image/jpeg' };
  }
}

export async function preparePdfUpload(
  uri: string,
  originalName: string,
): Promise<{ uri: string; name: string; mime: string }> {
  const base = originalName.replace(/[\\/]+/g, '_').trim() || `proof_${Date.now()}`;
  const name = /\.pdf$/i.test(base) ? base : `${base}.pdf`;
  const dest = await materializeLocalFile(uri, `proof_${Date.now()}.pdf`);
  return { uri: dest, name, mime: 'application/pdf' };
}

/**
 * 把本地路径变成 Expo File（实现 Blob / bytes()），供默认 Expo fetch 的 FormData 使用。
 * content:// 等先拷到缓存；file:// 直接打开。
 */
export async function asUploadFile(uri: string, destHint: string): Promise<ExpoFile> {
  let path = ensureFileUri(uri);
  if (!path.startsWith('file://') && !path.startsWith('/')) {
    path = await materializeLocalFile(path, destHint);
  }
  const file = new ExpoFile(path);
  if (typeof file.exists === 'boolean' && !file.exists) {
    throw new Error('无法读取所选文件');
  }
  return file;
}
