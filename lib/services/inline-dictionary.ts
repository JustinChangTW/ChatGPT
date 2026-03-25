export type DictionaryEntry = {
  term: string;
  translation: string;
  definition: string;
};

const BUILTIN_DICTIONARY: Record<string, DictionaryEntry> = {
  security: { term: 'security', translation: '安全', definition: '保護系統、資料與流程免於未授權存取或破壞。' },
  network: { term: 'network', translation: '網路', definition: '連接多個裝置以交換資料的通訊架構。' },
  packet: { term: 'packet', translation: '封包', definition: '網路傳輸中的最小資料單位。' },
  malware: { term: 'malware', translation: '惡意程式', definition: '設計來破壞、竊取或未授權控制系統的程式。' },
  firewall: { term: 'firewall', translation: '防火牆', definition: '依規則過濾進出流量的安全控制。' },
  exploit: { term: 'exploit', translation: '漏洞利用', definition: '利用系統漏洞來取得未授權行為的方法。' },
  payload: { term: 'payload', translation: '酬載', definition: '攻擊中實際執行惡意效果的程式內容。' },
  phishing: { term: 'phishing', translation: '釣魚攻擊', definition: '透過偽裝訊息誘騙受害者交出敏感資訊。' },
  encryption: { term: 'encryption', translation: '加密', definition: '把明文轉為密文，防止未授權讀取。' },
  authentication: { term: 'authentication', translation: '身分驗證', definition: '確認使用者或系統身分真實性的流程。' },
  authorization: { term: 'authorization', translation: '授權', definition: '決定已驗證身分可執行哪些操作。' },
  vulnerability: { term: 'vulnerability', translation: '弱點', definition: '系統可被攻擊者利用的缺陷。' }
};

export function lookupDictionaryTerm(term: string): DictionaryEntry | null {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  return BUILTIN_DICTIONARY[normalized] ?? null;
}
