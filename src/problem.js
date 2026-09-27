export function parseProblem(body, status = 0) {
  const type = typeof body?.type === 'string' && body.type.trim() ? body.type : null;
  const typeCode = type ? type.replace(/\/$/, '').split('/').pop() : null;
  const detail = typeof body?.detail === 'string' ? body.detail : typeof body?.error?.message === 'string' ? body.error.message : null;
  return { type, code: typeCode || body?.error?.code || 'HTTP_ERROR', detail, message: detail || (typeof body?.title === 'string' ? body.title : `요청에 실패했어요. (${status})`) };
}
