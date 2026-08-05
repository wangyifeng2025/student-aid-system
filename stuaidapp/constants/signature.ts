/** 困难认定「个人承诺 / 手写签字」约定（与纸质申请表、Web 端对齐）。 */

export const COMMITMENT_HANDWRITING_FILE = 'commitment_handwriting.png';
export const STUDENT_SIGNATURE_FILE = 'student_signature.png';

export const COMMITMENT_HANDWRITE_TEXT =
  '本人承诺以上所填写资料真实，如有虚假，愿承担相应责任。';

export const SIGNATURE_FILES = [
  COMMITMENT_HANDWRITING_FILE,
  STUDENT_SIGNATURE_FILE,
] as const;

export function isSignatureAttachment(fileName: string): boolean {
  return (SIGNATURE_FILES as readonly string[]).includes(fileName);
}
