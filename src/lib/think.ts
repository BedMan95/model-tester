/** Reasoning blocks some models emit inline (DeepSeek-R1, Qwen-QwQ, …). */
const THINK_TAGS = [
  ["<think>", "</think>"],
  ["<thinking>", "</thinking>"],
  ["<reasoning>", "</reasoning>"],
] as const;

export interface ThinkSegment {
  thinking: boolean;
  text: string;
}

/**
 * Splits a completion into reasoning/plain segments. An unclosed opener is
 * treated as still-streaming reasoning, so mid-token tags never flash as text.
 */
export function splitThink(text: string): ThinkSegment[] {
  const segments: ThinkSegment[] = [];
  let rest = text;

  while (rest) {
    let openIdx = -1;
    let openEnd = 0;
    let close = "";
    for (const [o, c] of THINK_TAGS) {
      const i = rest.indexOf(o);
      if (i !== -1 && (openIdx === -1 || i < openIdx)) {
        openIdx = i;
        openEnd = o.length;
        close = c;
      }
    }

    if (openIdx === -1) {
      segments.push({ thinking: false, text: rest });
      break;
    }

    if (openIdx > 0)
      segments.push({ thinking: false, text: rest.slice(0, openIdx) });

    const after = rest.slice(openIdx + openEnd);
    const closeIdx = after.indexOf(close);
    if (closeIdx === -1) {
      segments.push({ thinking: true, text: after });
      break;
    }
    if (closeIdx > 0) segments.push({ thinking: true, text: after.slice(0, closeIdx) });
    // Swallow the newline that usually follows the closing tag.
    rest = after.slice(closeIdx + close.length).replace(/^\n/, "");
  }

  return segments
    .map((s) => ({ thinking: s.thinking, text: s.thinking ? s.text.trim() : s.text }))
    .filter((s) => s.text.length > 0);
}
