import { Question } from '@/lib/schemas/question';

type ChapterProfile = {
  chapterNo: number;
  chapterTitle: string;
  questionTarget: number;
  domainTag: string;
  focusTopics: string[];
};

export type CCTKnowledgeItem = {
  id: string;
  chapterNo: number;
  chapterTitle: string;
  title: string;
  summary: string;
  keyPoints: string[];
  examSignals: string[];
  tags: string[];
};

const CHAPTER_PROFILES: ChapterProfile[] = [
  {
    chapterNo: 1,
    chapterTitle: 'Information Security Threats and Attacks',
    questionTarget: 18,
    domainTag: 'domain-1',
    focusTopics: [
      'threat-modeling',
      'risk-assessment',
      'social-engineering',
      'phishing',
      'malware',
      'ransomware',
      'dos',
      'mitm',
      'password-attacks'
    ]
  },
  {
    chapterNo: 2,
    chapterTitle: 'Network Security',
    questionTarget: 11,
    domainTag: 'domain-2',
    focusTopics: ['osi', 'tcp-ip', 'segmentation', 'vlan', 'acl', 'dmz', 'routing-security', 'nat', 'dns-security']
  },
  {
    chapterNo: 3,
    chapterTitle: 'Network Security Controls',
    questionTarget: 37,
    domainTag: 'domain-3',
    focusTopics: [
      'firewall',
      'ids',
      'ips',
      'proxy',
      'aaa',
      'mfa',
      'least-privilege',
      'zero-trust',
      'network-access-control',
      'vpn'
    ]
  },
  {
    chapterNo: 4,
    chapterTitle: 'Application Security and Cloud Computing',
    questionTarget: 14,
    domainTag: 'domain-4',
    focusTopics: ['owasp', 'injection', 'xss', 'csrf', 'secure-sdlc', 'api-security', 'shared-responsibility', 'iaas', 'saas']
  },
  {
    chapterNo: 5,
    chapterTitle: 'Wireless Device Security',
    questionTarget: 18,
    domainTag: 'domain-5',
    focusTopics: ['wifi', 'rogue-ap', 'evil-twin', 'bluetooth', 'mdm', 'byod', 'mobile-hardening', 'deauth', 'wpa3']
  },
  {
    chapterNo: 6,
    chapterTitle: 'Data Security',
    questionTarget: 16,
    domainTag: 'domain-6',
    focusTopics: ['data-classification', 'dlp', 'encryption', 'key-management', 'hash', 'signature', 'backup', 'retention']
  },
  {
    chapterNo: 7,
    chapterTitle: 'Network Monitoring and Analysis',
    questionTarget: 26,
    domainTag: 'domain-7',
    focusTopics: ['siem', 'logging', 'baseline', 'netflow', 'triage', 'forensics', 'anomaly-detection', 'alert-tuning', 'pcap']
  },
  {
    chapterNo: 8,
    chapterTitle: 'Incident and Risk Management',
    questionTarget: 21,
    domainTag: 'domain-8',
    focusTopics: [
      'incident-response',
      'containment',
      'eradication',
      'recovery',
      'lessons-learned',
      'risk-treatment',
      'business-continuity',
      'disaster-recovery'
    ]
  }
];

function toTitle(topic: string): string {
  return topic
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildItem(profile: ChapterProfile, idx: number): CCTKnowledgeItem {
  const topic = profile.focusTopics[idx % profile.focusTopics.length];
  const type = idx % 3 === 0 ? '觀念' : idx % 3 === 1 ? '判斷' : '情境';
  const order = idx + 1;
  const id = `ch${profile.chapterNo}-kb-${String(order).padStart(3, '0')}`;

  return {
    id,
    chapterNo: profile.chapterNo,
    chapterTitle: profile.chapterTitle,
    title: `${toTitle(topic)} ${type}重點 #${order}`,
    summary: `聚焦 ${toTitle(topic)} 在 C|CT 第 ${profile.chapterNo} 章的考點與實務情境，對應題目判斷與防護策略。`,
    keyPoints: [
      `先辨識 ${toTitle(topic)} 的風險訊號與前置條件。`,
      `將 ${toTitle(topic)} 對應到正確控制措施與部署位置。`,
      `比較常見錯誤選項與正確處置順序。`
    ],
    examSignals: [
      `情境敘述若提到 ${topic}，通常考控制分類或優先處置。`,
      '先排除看似合理但超出責任邊界的選項。',
      '若題目涉及流程先後，優先選擇可立即降低風險的步驟。'
    ],
    tags: [`chapter-${profile.chapterNo}`, profile.domainTag, topic, `${topic}-${type}`.toLowerCase()]
  };
}

function buildKnowledgeBase(): CCTKnowledgeItem[] {
  return CHAPTER_PROFILES.flatMap((profile) =>
    Array.from({ length: profile.questionTarget }, (_, idx) => buildItem(profile, idx))
  );
}

export const CCT_KNOWLEDGE_BASE: CCTKnowledgeItem[] = buildKnowledgeBase();

export function searchKnowledgeItems(params: { query: string; chapterNo: number | 'all' }): CCTKnowledgeItem[] {
  const query = params.query.trim().toLowerCase();
  return CCT_KNOWLEDGE_BASE.filter((item) => {
    const chapterMatched = params.chapterNo === 'all' || item.chapterNo === params.chapterNo;
    if (!chapterMatched) return false;
    if (!query) return true;
    return [item.title, item.summary, ...item.keyPoints, ...item.examSignals, ...item.tags].join(' ').toLowerCase().includes(query);
  });
}

export function matchKnowledgeByQuestion(question: Question): CCTKnowledgeItem[] {
  const chapterNo = Number((question.chapter.match(/(\d+)/) ?? [])[1] ?? NaN);
  const normalizedQuestionTags = new Set([...question.tags, ...question.keywords].map((x) => x.trim().toLowerCase()));
  return CCT_KNOWLEDGE_BASE.filter((item) => {
    if (Number.isFinite(chapterNo) && item.chapterNo !== chapterNo) return false;
    return item.tags.some((tag) => normalizedQuestionTags.has(tag.toLowerCase()));
  });
}
