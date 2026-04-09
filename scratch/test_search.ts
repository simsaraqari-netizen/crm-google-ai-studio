import { normalizeArabic } from '../src/utils';

export function searchMatch(source: string, query: string): boolean {
  if (!query) return true;
  const normalizedSource = normalizeArabic(source.toLowerCase());
  const normalizedQuery = normalizeArabic(query.toLowerCase());
  
  const sourceTokens = normalizedSource.split(/[\s,./\\؛،:() -]+/).filter(Boolean);
  const queryTokens = normalizedQuery.split(/[\s,./\\؛،:() -]+/).filter(Boolean);
  
  if (queryTokens.length === 0) return true;
  
  return queryTokens.every(qToken => sourceTokens.includes(qToken));
}

// Tests
const testCases = [
  { source: "قسيمة 322", query: "32", expected: false },
  { source: "قسيمة 32", query: "32", expected: true },
  { source: "مستأجرة اشبيلية", query: "اشب", expected: false },
  { source: "مستأجرة اشبيلية", query: "اشبيلية", expected: true },
  { source: "خالد فهد محمد", query: "خالد فهد", expected: true },
  { source: "هاتف 66554433", query: "44", expected: false },
  { source: "66-55-44", query: "55", expected: true },
];

console.log("Running Search Match Tests...");
testCases.forEach((tc, i) => {
  const result = searchMatch(tc.source, tc.query);
  const passed = result === tc.expected;
  console.log(`Test ${i + 1}: [${tc.query}] in [${tc.source}] -> Result: ${result} (Expected: ${tc.expected}) - ${passed ? '✅' : '❌'}`);
});
