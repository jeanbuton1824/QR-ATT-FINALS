export type QRPayload = {
  event: string;
  title?: string;
  start?: string;
  end?: string;
};

export function buildQRPayload(payload: QRPayload): string {
  return JSON.stringify({
    v: 1,
    event: payload.event,
    title: payload.title,
    start: payload.start,
    end: payload.end,
  });
}

export function parseQRPayload(rawPayload: string) {
  const raw = rawPayload.trim();

  if (!raw) {
    return {
      ok: false as const,
      message: 'Invalid QR code.',
    };
  }

  try {
    const data: unknown = JSON.parse(raw);
    const event =
      typeof data === 'string'
        ? data
        : isRecord(data)
          ? data.event ?? data.event_code ?? data.eventCode
          : null;

    if (typeof event !== 'string' || !event.trim()) {
      return {
        ok: false as const,
        message: 'Invalid QR code: missing event.',
      };
    }

    return {
      ok: true as const,
      payload: {
        event: event.trim(),
        title: isRecord(data) && typeof data.title === 'string' ? data.title : undefined,
        start: isRecord(data) && typeof data.start === 'string' ? data.start : undefined,
        end: isRecord(data) && typeof data.end === 'string' ? data.end : undefined,
      },
    };
  } catch {
    return {
      ok: true as const,
      payload: {
        event: raw,
      },
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
