export const CCT_DOMAIN_BLUEPRINT = [
  { domainNo: 1, domain: 'Information Security Threats and Attacks', weight: 11 },
  { domainNo: 2, domain: 'Network Security', weight: 7 },
  { domainNo: 3, domain: 'Network Security Controls', weight: 23 },
  { domainNo: 4, domain: 'Application Security and Cloud Computing', weight: 9 },
  { domainNo: 5, domain: 'Wireless Device Security', weight: 11 },
  { domainNo: 6, domain: 'Data Security', weight: 10 },
  { domainNo: 7, domain: 'Network Monitoring and Analysis', weight: 16 },
  { domainNo: 8, domain: 'Incident and Risk Management', weight: 13 }
] as const;

export function chapterLabel(chapter: string): string {
  const no = parseChapterNo(chapter);
  if (!no) return chapter;
  const mapped = CCT_DOMAIN_BLUEPRINT.find((d) => d.domainNo === no);
  return mapped ? `${chapter} - ${mapped.domain}` : chapter;
}

export function parseChapterNo(chapter: string): number | null {
  const m = chapter.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function domainLabel(domain: string): string {
  const mapped = CCT_DOMAIN_BLUEPRINT.find((d) => d.domain === domain);
  return mapped ? `Domain ${mapped.domainNo} - ${mapped.domain}` : domain;
}

export function domainNoByName(domain: string): number | null {
  return CCT_DOMAIN_BLUEPRINT.find((d) => d.domain === domain)?.domainNo ?? null;
}
