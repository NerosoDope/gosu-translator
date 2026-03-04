/**
 * Sinh mã job thống nhất cho toàn bộ chức năng.
 * Format: {PREFIX}-{TIMESTAMP}-{RANDOM6}
 * Ví dụ: FILE-1730123456789-a1b2c3, DIRECT-1730123456789-a1b2c3
 */
const RANDOM_LENGTH = 6;

export function generateJobCode(prefix: string): string {
  const ts = Date.now();
  const random = Math.random().toString(36).slice(2, 2 + RANDOM_LENGTH);
  return `${prefix}-${ts}-${random}`;
}

/** Prefix chuẩn cho từng loại job (dùng với generateJobCode). */
export const JOB_CODE_PREFIX = {
  TRANSLATE_FILE: 'FILE',
  TRANSLATE_DIRECT: 'DIRECT',
  PROOFREAD: 'PROOFREAD',
  GLOSSARY: 'GLOSSARY',
} as const;
