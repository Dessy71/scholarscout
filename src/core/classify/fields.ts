/** Field / discipline matching with adjacent-discipline support. */

export interface FieldDef {
  key: string;
  label: string;
  keywords: RegExp;
}

export const FIELD_DEFS: FieldDef[] = [
  { key: 'computer_science', label: 'Computer Science', keywords: /\b(computer science|computing|informatics)\b/i },
  { key: 'information_technology', label: 'Information Technology', keywords: /\b(information technology|\bICT\b|\bIT\b(?![a-z]))\b/ },
  { key: 'software_engineering', label: 'Software Engineering', keywords: /\b(software engineer|software development|programming)\b/i },
  { key: 'cloud', label: 'Cloud Computing', keywords: /\b(cloud computing|cloud engineer|aws|azure|google cloud|cloud infrastructure)\b/i },
  { key: 'devops', label: 'DevOps', keywords: /\b(devops|site reliability|sre\b|ci\/cd|platform engineering|infrastructure as code)\b/i },
  { key: 'ai', label: 'Artificial Intelligence', keywords: /\b(artificial intelligence|\bAI\b)/ },
  { key: 'ml', label: 'Machine Learning', keywords: /\b(machine learning|deep learning|neural network)\b/i },
  { key: 'data_science', label: 'Data Science', keywords: /\b(data science|data analytics?|big data|data engineer)\b/i },
  { key: 'cybersecurity', label: 'Cybersecurity', keywords: /\b(cyber ?security|information security|infosec|network security)\b/i },
  { key: 'networks', label: 'Computer Networks', keywords: /\b(computer network|networking|telecommunication)\b/i },
  { key: 'distributed_systems', label: 'Distributed Systems', keywords: /\b(distributed systems?|parallel computing)\b/i },
  { key: 'information_systems', label: 'Information Systems', keywords: /\b(information systems?|management information)\b/i },
  { key: 'systems_engineering', label: 'Systems Engineering', keywords: /\b(systems engineering)\b/i },
  { key: 'software_architecture', label: 'Software Architecture', keywords: /\b(software architecture|solutions? architect)\b/i },
  { key: 'automation', label: 'Automation', keywords: /\b(automation|robotic process|rpa\b)\b/i },
  { key: 'tech4dev', label: 'Technology for Development', keywords: /\b(ict4d|tech(?:nology)? for (?:development|good|social)|digital development|digital transformation)\b/i },
  { key: 'env_tech', label: 'Environmental Technology', keywords: /\b(environmental (?:technology|engineering|science|monitoring)|environment(?:al)? data)\b/i },
  { key: 'climate_tech', label: 'Climate Technology', keywords: /\b(climate (?:tech|change|action|science|resilience|adaptation|mitigation)|carbon|greenhouse gas|net[- ]zero)\b/i },
  { key: 'clean_air', label: 'Clean Air Technology', keywords: /\b(clean air|air quality|air pollution|atmospheric)\b/i },
  { key: 'sustainability', label: 'Sustainability Technology', keywords: /\b(sustainab|renewable energy|green energy|circular economy|clean energy)\b/i },
];

const ENVIRONMENTAL_KEYS = new Set(['env_tech', 'climate_tech', 'clean_air', 'sustainability']);

/** Adjacent disciplines that count when the programme has a tech component. */
const ADJACENT_RE = /\b(engineering|mathematics|statistics|physics|electronics|electrical|mechatronics|stem\b|science and technology|innovation|digital)\b/i;
const TECH_COMPONENT_RE = /\b(technolog|comput|digital|software|data|programming|coding|innovation|engineer)\b/i;

export interface FieldMatch {
  matchedFields: string[];       // field keys
  matchedLabels: string[];
  environmental: boolean;
  adjacentOnly: boolean;         // matched only via adjacent-discipline rule
  /** True if the text signals it's open to all/any fields of study. */
  openToAllFields: boolean;
}

const OPEN_FIELDS_RE = /\b(any (?:field|discipline|subject)|all (?:fields|disciplines|subjects)|any academic (?:field|discipline)|field of your choice|wide range of (?:subjects|courses|disciplines))\b/i;

export function matchFields(text: string | null | undefined): FieldMatch {
  const result: FieldMatch = { matchedFields: [], matchedLabels: [], environmental: false, adjacentOnly: false, openToAllFields: false };
  if (!text) return result;
  for (const def of FIELD_DEFS) {
    if (def.keywords.test(text)) {
      result.matchedFields.push(def.key);
      result.matchedLabels.push(def.label);
      if (ENVIRONMENTAL_KEYS.has(def.key)) result.environmental = true;
    }
  }
  result.openToAllFields = OPEN_FIELDS_RE.test(text);
  if (result.matchedFields.length === 0 && ADJACENT_RE.test(text) && TECH_COMPONENT_RE.test(text)) {
    result.adjacentOnly = true;
  }
  return result;
}
