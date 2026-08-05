/** 困难认定「个人承诺 / 手写签字」约定（与纸质申请表布局对齐）。 */

/** 手写承诺正文附件文件名（上传时固定此名，便于校验与替换）。 */
export const COMMITMENT_HANDWRITING_FILE = 'commitment_handwriting.png';

/** 学生本人（或监护人）签字附件文件名。 */
export const STUDENT_SIGNATURE_FILE = 'student_signature.png';

/** 纸质表要求手写的承诺原文。 */
export const COMMITMENT_HANDWRITE_TEXT =
  '本人承诺以上所填写资料真实，如有虚假，愿承担相应责任。';

export const SIGNATURE_FILES = [
  COMMITMENT_HANDWRITING_FILE,
  STUDENT_SIGNATURE_FILE,
] as const;

export function isSignatureAttachment(fileName: string): boolean {
  return (SIGNATURE_FILES as readonly string[]).includes(fileName);
}
