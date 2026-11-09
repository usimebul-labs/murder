const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];

/** 마지막 글자에 받침이 있는지 (한글 음절, 숫자, 영문 일부) */
function hasFinal(word: string): boolean {
  const last = word.trim().at(-1) ?? "";
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(last)) return DIGIT_HAS_FINAL[Number(last)] ?? false;
  return /[lmnr]/i.test(last);
}

/** 받침에 맞는 조사를 붙인다. josa("빅터 헤일", "이/가") → "빅터 헤일이" */
export function josa(
  word: string,
  pair: "이/가" | "을/를" | "은/는" | "와/과" | "으로/로",
): string {
  const [withFinal, without] = pair.split("/") as [string, string];
  if (pair === "으로/로") {
    const last = word.trim().at(-1) ?? "";
    const code = last.charCodeAt(0);
    const rieul = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8;
    return word + (hasFinal(word) && !rieul ? withFinal : without);
  }
  return word + (hasFinal(word) ? withFinal : without);
}
