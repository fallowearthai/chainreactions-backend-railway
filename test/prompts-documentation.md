# Gemini OSINT Prompts Documentation

## 📋 Overview

This document provides a comprehensive reference for all system and user prompts used in the ChainReactions OSINT (Open-Source Intelligence) research system. It includes prompts from both the test configuration file and the production GeminiNormalSearchService, along with their evolution and optimization strategies.

**Purpose**: Investigate potential connections between institutions and risk entities using web search capabilities, with multi-language support and evidence-based analysis.

## 📁 File Sources

| File | Location | Purpose |
|------|----------|---------|
| `prompt.json` | `/test/prompt.json` | Original prompt template for testing |
| `GeminiNormalSearchService.ts` | `/services/entity-relations/src/services/GeminiNormalSearchService.ts` | Production-optimized prompt service |

---

## 🤖 System Prompts

### 1. Original System Prompt (from `test/prompt.json`)

#### JSON Structure
```json
{
  "system_instruction": {
    "parts": [
      {
        "text": "[PROMPT_CONTENT]"
      }
    ]
  }
}
```

#### Prompt Content

```
## Prompt: OSINT Research on Institutional Risk Links

**Role**
You are deepdiver, a Research Security Analyst conducting initial open-source intelligence (OSINT) gathering.

---

### <Goal>

Using web search capabilities, investigate potential connections (e.g., documented cooperation, funding, joint projects, shared personnel, significant mentions linking them) between **Institution A** and each item in **Risk List C** within a specified time range.

Summarize key findings, identify any **potential intermediary organizations (B)** explicitly mentioned as linking **A** and **C**, and provide **source URLs**.
Treat **each item in List C individually** for investigation.

---

### <Information Gathering Strategy>

For each item in **Risk List C**:

* Formulate search queries combining **Institution A** (`{Institution A}`, `{Location A}`) with the specific risk item from List C.
* If `time_range_start` and `time_range_end` are provided, incorporate this date range into your search using Google's `before:` and `after:` filters or equivalent.

**CRITICAL**: When time range is specified, you MUST ONLY include information from within this exact time period. Events, publications, or relationships outside this range MUST BE EXCLUDED entirely from your analysis.

Analyze results from:
* Reports, news, official sites, academic publications, or other public documents within the timeframe.
* Focus on **specific, verifiable connections**, not general background info.

Look for evidence of:
* **Direct Links**: Clear collaboration, joint funding, projects, or documented relationships.
* **Indirect Links**: A and C are both explicitly linked through **intermediary B** in a documented shared outcome.
* **Significant Mentions**: A and C are jointly discussed in a risk-related context, even without direct cooperation.

For **Potential B**, ensure:
* It is explicitly cited as facilitating the A–C connection.
* Mere co-membership in alliances or general funding from B is **not sufficient** unless a specific A–C project via B is described and sourced.

If credible evidence is found:
* Summarize the connection and assess reliability.
* **Avoid** irrelevant info like rankings or general institution pages unless they directly support a finding.

If no evidence is found:
* Clearly note that after thorough search within the range.

---

### <Input>

* **Institution A**: `{Institution A}`
* **Location A**: `{Location A}`
* **Risk List C**: `{List C}`  // Example: ["Military", "Specific Org X", "Technology Y"]
* **Time Range Start**: `{time_range_start}`  // Optional, format: "YYYY-MM"
* **Time Range End**: `{time_range_end}`  // Optional, format: "YYYY-MM"

---

### <Output Instructions>

Output **only** a JSON list.

Each item in **Risk List C** must be a separate JSON object containing:

```json
{
  "risk_item": "string",
  "institution_A": "string",
  "relationship_type": "string", // One of: "Direct", "Indirect", "Significant Mention", "Unknown", "No Evidence Found"
  "finding_summary": "string", // CRITICAL: Citations MUST match exactly with sources array positions
  "potential_intermediary_B": ["string"] | null, // Only if clearly described and cited.
  "sources": ["string"] // CRITICAL: Must contain exactly the same number of URLs as citations in finding_summary
}
```

```

### 2. Enhanced System Prompt (Further Optimized Version)

This version represents further optimization based on practical usage, focusing on essential requirements while maintaining AI autonomy.

```typescript
private buildOptimizedSystemInstruction(): string {
  return `**ROLE**
You are an expert OSINT analyst specializing in institutional risk assessment and relationship mapping.

**MISSION**
Using web search capabilities, investigate potential connections (e.g., documented cooperation, funding, joint projects, shared personnel, significant mentions linking them) between Institution A and Risk List C. Focus on verifiable, evidence-based connections within the specified time range.

**SEARCH STRATEGY**

For risk entity in Risk List C:

1. **Multi-language Search Requirements:**
   - Search in BOTH English AND the native language of the location
   - Example: For China, search using English terms AND Chinese terms
   - Example: For Germany, search using English terms AND German terms
   - Example: For worldwide locations, search using English terms

2. **Time Range Compliance:**
   - When dates are provided, use Google's before: and after: filters
   - ONLY include information from within the exact specified time period
   - Events outside the range must be completely excluded

3. **Evidence Quality Standards:**
   - Require specific, verifiable connections with clear attribution
   - Avoid general background information unless directly relevant

**CONNECTION TYPES TO IDENTIFY**

- **Direct**: Clear collaboration, joint funding, projects, or documented relationships.
- **Indirect**: A and C are both explicitly linked through intermediary B in a documented shared outcome.
- **Significant Mention**: A and C are jointly discussed in a risk-related context, even without direct cooperation.
- **No Evidence Found**: Thorough search yields no verifiable connections

**INTERMEDIARY REQUIREMENTS**
- Must be explicitly cited as facilitating the A-C connection
- General funding or membership is insufficient without specific A-C linkage
- Must have documented evidence of the specific intermediary role

**OUTPUT REQUIREMENTS**

Return ONLY a JSON array. Each risk entity must be a separate object:

\`\`\`json
[
  {
    "risk_item": "exact risk entity name from the input list",
    "institution_A": "exact institution name from input",
    "relationship_type": "Direct|Indirect|Significant Mention|Unknown|No Evidence Found",
    "finding_summary": "comprehensive analysis with specific evidence",
    "potential_intermediary_B": "intermediary name(s) or null"
  }
]
\`\`\`

**CRITICAL REQUIREMENTS:**

1. **Evidence-Based Analysis**: Every claim must be supported by search results
2. **Language Accuracy**: Search in both English and native languages
3. **Time Compliance**: Strictly adhere to specified time ranges

**QUALITY STANDARDS:**
- If connection claimed: provide specific evidence
- If no evidence found: clearly state "No Evidence Found"
- Avoid speculation or assumptions
- Exclude irrelevant institutional background
- Focus on documented relationships and verifiable facts`;
}
```

### 3. Key Differences & Improvements

| Aspect | Original Prompt | First Enhanced Prompt | Further Optimized Prompt | Improvements |
|--------|----------------|---------------------|------------------------|-------------|
| **Structure** | Mixed sections with `<Goal>`, `<Strategy>` tags | Clean markdown with clear headers | Streamlined markdown, essential sections only | Progressive simplification while maintaining clarity |
| **Role Definition** | "deepdiver, Research Security Analyst" | "expert OSINT analyst" | Same, but more concise | Professional and consistent |
| **Language Support** | Brief mention in user prompt only | Detailed multi-language requirements section | Maintained detailed requirements | Comprehensive language coverage |
| **Source Quality** | General guidance | Specific domain prioritization (.gov, .edu) | Simplified to essential principles | Balanced guidance without over-constraining |
| **Evidence Standards** | Basic guidelines | 4 detailed quality standards | 2 essential standards only | Focus on core requirements |
| **Critical Requirements** | Scattered throughout | 6 detailed requirements | 3 essential requirements | Streamlined to most critical aspects |
| **User Prompt Tone** | Template-based, formal | Structured, formal headers | Natural, conversational approach | Better AI-user interaction |
| **Output Format** | Includes manual citations | Focuses on analysis content | Maintained clear JSON structure | Consistent, reliable output |

---

## 👤 User Prompts

### 1. Template User Prompt (from `test/prompt.json`)

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "I need you to investigate potential connections between the following institution and risk items: Institution A: {{ $json['Institution '] }} Location: {{ $json.Location }} Risk List C: {{ $json['Risk List C'] }}. For each risk item, please analyze any direct or indirect connections, or significant mentions linking them with the institution.IMPORTANT INSTRUCTION:  You MUST search for each item in BOTH English AND the native language of {{ $json.Location }}. For example, if the country is \"China\", search using both English terms AND Chinese terms. If the country is \"Germany\", search using both English terms AND German terms. If the country is \"Worldwide\", search using English terms. {{ $json['Time Range'] }}."
        }
      ]
    }
  ]
}
```

### 2. Enhanced User Prompt (Further Optimized Version)

This version uses a more natural, conversational approach while maintaining all critical requirements.

```typescript
private buildUserPrompt(request: NormalSearchRequest): string {
  const timeRangeText = request.Start_Date && request.End_Date
    ? `Time Range: STRICTLY ${request.Start_Date} to ${request.End_Date}. Only include information from within this exact period.`
    : 'Time Range: No specific time constraints - include recent and historical connections.';

  const languageInstruction = this.getLanguageSearchInstruction(request.Location);

  return `I need you to investigate potential connections between the following institution and risk items:

**Institution A:** ${request.Target_institution}
**Location:** ${request.Location}
**Risk List C:** ${request.Risk_Entity}
**${timeRangeText}**

**SEARCH INSTRUCTIONS:**
${languageInstruction}

**ANALYSIS REQUIREMENTS:**
For risk item in Risk List C, investigate:
1. Direct connections (cooperation, projects, formal relationships)
2. Indirect connections (through intermediaries with specific A-C linkage)
3. Significant mentions (joint discussion in risk contexts)
4. Evidence quality and source reliability

**OUTPUT FORMAT:**
Return a JSON array with one object per risk entity. Each object must contain:
- risk_item: exact name from input list
- institution_A: exact institution name
- relationship_type: "Direct", "Indirect", "Significant Mention", "Unknown", or "No Evidence Found"
- finding_summary: detailed evidence-based analysis
- potential_intermediary_B: intermediary name(s) or null

**CRITICAL:**
- Search in both English AND native languages
- Use high-quality sources only
- Provide specific evidence for all claims
- If no evidence found: state "No Evidence Found"
- Exclude speculation and general background`;
}
```

### 3. Language Search Instructions

```typescript
private getLanguageSearchInstruction(location: string): string {
  const locationLower = location.toLowerCase();

  // Map locations to their native languages
  const languageMap: { [key: string]: string[] } = {
    'china': ['Chinese (中文)'],
    'germany': ['German (Deutsch)'],
    'france': ['French (Français)'],
    'japan': ['Japanese (日本語)'],
    'south korea': ['Korean (한국어)'],
    'russia': ['Russian (Русский)'],
    'spain': ['Spanish (Español)'],
    'italy': ['Italian (Italiano)'],
    'brazil': ['Portuguese (Português)'],
    'india': ['Hindi (हिन्दी)'],
    'israel': ['Hebrew (עברית)'],
    'saudi arabia': ['Arabic (العربية)'],
    'egypt': ['Arabic (العربية)'],
    'mexico': ['Spanish (Español)'],
    'argentina': ['Spanish (Español)'],
    'netherlands': ['Dutch (Nederlands)'],
    'sweden': ['Swedish (Svenska)'],
    'norway': ['Norwegian (Norsk)'],
    'denmark': ['Danish (Dansk)'],
    'finland': ['Finnish (Suomi)'],
    'poland': ['Polish (Polski)'],
    'turkey': ['Turkish (Türkçe)'],
    'iran': ['Persian (فارسی)'],
    'pakistan': ['Urdu (اردو)'],
    'bangladesh': ['Bengali (বাংলা)'],
    'vietnam': ['Vietnamese (Tiếng Việt)'],
    'thailand': ['Thai (ไทย)'],
    'indonesia': ['Indonesian (Bahasa Indonesia)'],
    'malaysia': ['Malay (Bahasa Melayu)'],
    'philippines': ['Filipino (Filipino)']
  };

  // Check for exact matches first
  for (const [country, languages] of Object.entries(languageMap)) {
    if (locationLower === country) {
      return `Search in ENGLISH and ${languages.join(' and ')}. Use search terms in both languages for comprehensive coverage.`;
    }
  }

  // Check for partial matches
  for (const [country, languages] of Object.entries(languageMap)) {
    if (locationLower.includes(country)) {
      return `Search in ENGLISH and ${languages.join(' and ')}. Use search terms in both languages for comprehensive coverage.`;
    }
  }

  // Default for worldwide or unrecognized locations
  return locationLower.includes('worldwide') || locationLower.includes('global')
    ? 'Search in ENGLISH only.'
    : 'Search in ENGLISH and the local language of the region. Research the primary language(s) spoken in this location and include search terms in those languages.';
}
```

---

## ⚙️ Configuration & Parameters

### 1. Generation Configuration

#### Original Configuration (from `test/prompt.json`)
```json
{
  "generationConfig": {
    "thinkingConfig": {
      "thinkingBudget": 12000
    },
    "temperature": 0.2,
    "maxOutputTokens": 65536,
    "topP": 0.95,
    "topK": 10
  }
}
```

#### Enhanced Configuration (from `GeminiNormalSearchService.ts`)
```typescript
generationConfig: {
  // CRITICAL: NO thinkingConfig - this enables grounding chunks
  temperature: 0.2,
  maxOutputTokens: 65536,
  topP: 0.95,
  topK: 10
}
```

**Key Difference**: Enhanced version disables `thinkingConfig` to enable grounding chunks for better source attribution.

### 2. Tool Configuration

#### Original Tools
```json
{
  "tools": [
    {
      "codeExecution": {}
    },
    {
      "googleSearch": {}
    }
  ]
}
```

#### Enhanced Tools
```typescript
tools: [
  {
    google_search: {}  // Latest tool format (underscore version)
  }
]
```

**Improvement**: Uses latest Google Search tool format for better integration.

### 3. API Request Structure

```typescript
private buildOptimizedRequestBody(request: NormalSearchRequest): GeminiRequestBody {
  return {
    system_instruction: {
      parts: [
        {
          text: this.buildOptimizedSystemInstruction()
        }
      ]
    },
    contents: [
      {
        parts: [
          {
            text: this.buildUserPrompt(request)
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 65536,
      topP: 0.95,
      topK: 10
    },
    tools: [
      {
        google_search: {}
      }
    ]
  };
}
```

---

## 🎯 Usage Examples

### 1. Basic Request Structure

```typescript
interface NormalSearchRequest {
  Target_institution: string;    // "University of Cambridge"
  Location: string;              // "United Kingdom"
  Risk_Entity: string;           // "Military, AI Research, Nuclear"
  Start_Date?: string;           // "2020-01"
  End_Date?: string;             // "2024-12"
}
```

### 2. Example API Call

```typescript
const request: NormalSearchRequest = {
  Target_institution: "Tsinghua University",
  Location: "China",
  Risk_Entity: "Military, Artificial Intelligence, Semiconductor",
  Start_Date: "2020-01",
  End_Date: "2024-12"
};

const result = await geminiService.executeEnhancedNormalSearch(request);
```

### 3. Expected Response Format

```json
{
  "results": [
    {
      "risk_item": "Military",
      "institution_A": "Tsinghua University",
      "relationship_type": "Indirect",
      "finding_summary": "Evidence found of military research collaborations through specific projects with intermediary organizations...",
      "potential_intermediary_B": ["National Natural Science Foundation of China"],
      "key_evidence": [
        {
          "text": "Tsinghua University received funding for military AI research projects...",
          "source_indices": [1, 3, 5]
        }
      ],
      "sources": [
        {
          "title": "University Research Funding Report",
          "url": "https://example.gov/funding-report",
          "type": "government",
          "chunk_index": 0
        }
      ],
      "search_queries": ["Tsinghua University military research China 2020..2024"],
      "quality_metrics": {
        "evidence_count": 3,
        "source_count": 2,
        "coverage_percentage": 75.0,
        "source_quality_score": 0.85
      }
    }
  ],
  "grounding_metadata": {
    "has_grounding": true,
    "grounding_chunks": [...],
    "grounding_supports": [...],
    "web_search_queries": [...]
  },
  "grounding_metrics": {
    "chunks_count": 8,
    "supports_count": 12,
    "queries_count": 5,
    "avg_chunk_relevance": 0.78
  },
  "enhanced_mode": true
}
```

---

## 📊 Supported Languages & Locations

### Complete Language Mapping

| Country/Region | Native Language | Search Instruction |
|----------------|-----------------|-------------------|
| China | Chinese (中文) | English + Chinese |
| Germany | German (Deutsch) | English + German |
| France | French (Français) | English + French |
| Japan | Japanese (日本語) | English + Japanese |
| South Korea | Korean (한국어) | English + Korean |
| Russia | Russian (Русский) | English + Russian |
| Spain | Spanish (Español) | English + Spanish |
| Italy | Italian (Italiano) | English + Italian |
| Brazil | Portuguese (Português) | English + Portuguese |
| India | Hindi (हिन्दी) | English + Hindi |
| Israel | Hebrew (עברית) | English + Hebrew |
| Saudi Arabia/Egypt | Arabic (العربية) | English + Arabic |
| Mexico/Argentina | Spanish (Español) | English + Spanish |
| Netherlands | Dutch (Nederlands) | English + Dutch |
| Sweden | Swedish (Svenska) | English + Swedish |
| Norway | Norwegian (Norsk) | English + Norwegian |
| Denmark | Danish (Dansk) | English + Danish |
| Finland | Finnish (Suomi) | English + Finnish |
| Poland | Polish (Polski) | English + Polish |
| Turkey | Turkish (Türkçe) | English + Turkish |
| Iran | Persian (فارسی) | English + Persian |
| Pakistan | Urdu (اردو) | English + Urdu |
| Bangladesh | Bengali (বাংলা) | English + Bengali |
| Vietnam | Vietnamese (Tiếng Việt) | English + Vietnamese |
| Thailand | Thai (ไทย) | English + Thai |
| Indonesia | Indonesian (Bahasa Indonesia) | English + Indonesian |
| Malaysia | Malay (Bahasa Melayu) | English + Malay |
| Philippines | Filipino (Filipino) | English + Filipino |
| Worldwide/Global | N/A | English only |

---

## 🔍 Quality Control & Validation

### 1. Source Quality Assessment

```typescript
private isHighQualitySource(source: EnhancedSource): boolean {
  const url = source.url.toLowerCase();
  const title = source.title.toLowerCase();

  // Exclude low-quality or irrelevant sources
  const excludedPatterns = [
    /facebook\.com/, /twitter\.com/, /instagram\.com/,
    /linkedin\.com/, /youtube\.com/, /tiktok\.com/,
    /reddit\.com/, /pinterest\.com/, /tumblr\.com/,
    /bit\.ly/, /tinyurl\.com/, /goo\.gl/, /ow\.ly/, /bit\.do/
  ];

  // Check for excluded patterns
  for (const pattern of excludedPatterns) {
    if (pattern.test(url)) return false;
  }

  // Check for high-quality indicators
  const qualityIndicators = [
    /\.edu$/, /\.gov$/, /\.org$/, /news/, /wikipedia/,
    /reuters/, /associated-press/, /bloomberg/, /financial-times/,
    /wall-street-journal/, /guardian/, /bbc/, /npr/, /pbs/,
    /academic/, /research/, /journal/, /publication/
  ];

  // Prefer high-quality sources
  let hasQualityIndicator = false;
  for (const indicator of qualityIndicators) {
    if (indicator.test(url) || indicator.test(title)) {
      hasQualityIndicator = true;
      break;
    }
  }

  const hasReasonableTitle = title.length > 10 && title.length < 200;
  return hasQualityIndicator || hasReasonableTitle;
}
```

### 2. Relationship Type Validation

```typescript
const validRelationshipTypes = [
  'Direct',
  'Indirect',
  'Significant Mention',
  'Unknown',
  'No Evidence Found'
];
```

### 3. Evidence Quality Standards

- **Government Sources**: .gov domains - highest reliability
- **Academic Sources**: .edu domains - research papers, studies
- **News Organizations**: Established news outlets with editorial standards
- **Organizational Sources**: .org domains - think tanks, NGOs
- **Commercial Sources**: .com domains - news sites, industry reports

### 4. Excluded Source Types

- **Social Media**: Facebook, Twitter, Instagram, LinkedIn
- **Video Platforms**: YouTube, TikTok
- **Forums & Blogs**: Reddit, personal blogs
- **URL Shorteners**: bit.ly, tinyurl.com, goo.gl

---

## 🚀 Best Practices & Guidelines

### 1. Prompt Engineering Principles Applied

1. **Clear Role Definition**: Specific OSINT analyst persona
2. **Structured Instructions**: Logical flow from strategy to output
3. **Explicit Constraints**: Clear boundaries and requirements
4. **Quality Standards**: Specific criteria for evidence and sources
5. **Error Prevention**: Built-in validation and recovery mechanisms

### 2. Multi-language Search Strategy

1. **Primary Language**: Always include English for broader coverage
2. **Native Language**: Include local language for local sources
3. **Search Terms**: Use both English and native language keywords
4. **Cultural Context**: Consider local naming conventions and terminology

### 3. Evidence Hierarchy

1. **Direct Evidence**: Official documents, press releases, reports
2. **Corroborating Evidence**: Multiple independent sources
3. **Secondary Evidence**: News articles, academic papers
4. **Tertiary Evidence**: Industry reports, think tank analysis

### 4. Time Range Compliance

1. **Strict Filtering**: Use Google's before: and after: operators
2. **Date Verification**: Cross-reference publication dates
3. **Range Boundaries**: Exclude events outside specified range
4. **Contextual Relevance**: Consider historical context appropriately

### 5. Output Format Standards

1. **JSON Structure**: Consistent, machine-readable format
2. **Required Fields**: All necessary data points included
3. **Data Types**: Proper typing and formatting
4. **Validation**: Built-in checks for data integrity

---

## 🛠️ Development & Maintenance

### 1. Code Organization

- **System Prompt**: Centralized in `buildOptimizedSystemInstruction()`
- **User Prompt**: Dynamic generation with `buildUserPrompt()`
- **Language Logic**: Separate `getLanguageSearchInstruction()` method
- **Validation**: Comprehensive validation methods

### 2. Testing Strategy

- **Unit Tests**: Individual prompt components
- **Integration Tests**: Full API request/response cycle
- **Quality Tests**: Source quality and validation checks
- **Performance Tests**: Response time and token usage

### 3. Monitoring & Metrics

- **Grounding Metrics**: Chunk relevance and support coverage
- **Quality Scores**: Source quality assessment
- **Performance Metrics**: Execution time and token efficiency
- **Error Tracking**: Validation failures and recovery attempts

### 4. Version Control

- **Prompt Versions**: Track changes and improvements
- **A/B Testing**: Compare prompt performance
- **Rollback Capability**: Revert to previous versions if needed
- **Documentation**: Keep this document updated with changes

---

## 📝 Quick Reference

### Essential Prompt Components (Latest Optimized Version)

1. **Role**: Expert OSINT analyst
2. **Mission**: Investigate institutional connections with evidence-based approach
3. **Strategy**: Multi-language, time-bound, focused on verifiable connections
4. **Output**: Clean JSON array with essential fields only
5. **Quality**: Specific evidence with clear attribution

### Critical Requirements (Streamlined)

- ✅ Evidence-Based Analysis: Every claim must be supported by search results
- ✅ Language Accuracy: Search in both English and native languages
- ✅ Time Compliance: Strictly adhere to specified time ranges

### Optimization Philosophy

- **Essential Focus**: Remove over-detailed instructions while preserving core requirements
- **AI Autonomy**: Trust AI to make appropriate source quality and evidence decisions
- **Natural Interaction**: Use conversational tone in user prompts for better understanding
- **Progressive Refinement**: Balance guidance with flexibility

### Common Pitfalls to Avoid

- ❌ Over-constraining AI with excessive detailed requirements
- ❌ Single-language search only
- ❌ Ignoring time range constraints
- ❌ Speculation without specific evidence
- ❌ Inconsistent JSON output format
- ❌ Missing clear attribution for claims

---

*Document Last Updated: October 22, 2025*
*Version: 1.0 - Initial comprehensive documentation*