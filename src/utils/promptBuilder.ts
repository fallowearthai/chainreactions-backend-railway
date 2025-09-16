import { SearchRequest } from '../types/gemini';

export class PromptBuilder {
  private static readonly SYSTEM_INSTRUCTION = `## Prompt: OSINT Research on Institutional Risk Links

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

* Formulate search queries combining **Institution A** (\`{Institution A}\`, \`{Location A}\`) with the specific risk item from List C.
* If \`time_range_start\` and \`time_range_end\` are provided, incorporate this date range into your search using Google's \`before:\` and \`after:\` filters or equivalent. **CRITICAL: When time range is specified, you MUST ONLY include information from within this exact time period. Events, publications, or relationships outside this range MUST BE EXCLUDED entirely from your analysis.**

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

* **Institution A**: \`{Institution A}\`
* **Location A**: \`{Location A}\`
* **Risk List C**: \`{List C}\`  // Example: [\\"Military\\", \\"Specific Org X\\", \\"Technology Y\\"]
* **Time Range Start**: \`{time_range_start}\`  // Optional, format: \\"YYYY-MM\\"
* **Time Range End**: \`{time_range_end}\`  // Optional, format: \\"YYYY-MM\\"

---

### <Output Instructions>

Output **only** a JSON list.

Each item in **Risk List C** must be a separate JSON object containing:

\`\`\`json
{
  \\"risk_item\\": \\"string\\",
  \\"institution_A\\": \\"string\\",
  \\"relationship_type\\": \\"string\\", // One of: \\"Direct\\", \\"Indirect\\", \\"Significant Mention\\", \\"Unknown\\", \\"No Evidence Found\\"
  \\"finding_summary\\": \\"string\\", // CRITICAL: Citations MUST match exactly with sources array positions
  \\"potential_intermediary_B\\": [\\"string\\"] | null, // Only if clearly described and cited.
  \\"sources\\": [\\"string\\"], // CRITICAL: Must contain exactly the same number of URLs as citations in finding_summary
  \\"search_completeness\\": \\"string\\", // Brief assessment of search thoroughness
  \\"confidence_level\\": \\"string\\" // High/Medium/Low based on source quality and quantity
}
\`\`\``;

  static buildSearchPrompt(request: SearchRequest): string {
    const { Target_institution, Risk_Entity, Location, Start_Date, End_Date } = request;

    // Parse risk entities from comma-separated string
    const riskEntities = Risk_Entity.split(',').map(entity => entity.trim());

    let timeRangeInstruction = '';
    if (Start_Date && End_Date) {
      timeRangeInstruction = `focusing STRICTLY on information within the specified time range ${Start_Date} to ${End_Date}`;
    }

    return `I need you to investigate potential connections between the following institution and risk items:
Institution A: ${Target_institution}
Location: ${Location}
Risk List C: [${riskEntities.map(entity => `"${entity}"`).join(', ')}]

For each risk item, please analyze any direct or indirect connections, or significant mentions linking them with the institution.

IMPORTANT INSTRUCTIONS:
1. You MUST search for each item in BOTH English AND the native language of ${Location}. For example, if the country is "China", search using both English terms AND Chinese terms.
2. Use MULTIPLE search strategies:
   - Exact company names in quotes
   - Product/technology names (software, hardware, services)
   - Business relationship terms (partnership, licensing, distribution, collaboration)
   - Include "filetype:pdf" searches for official documents
   - Search for press releases, annual reports, and industry publications
3. Try ALTERNATIVE company name variations and abbreviations
4. Search for specific evidence like contracts, agreements, joint ventures, or technology transfers

${timeRangeInstruction}.`;
  }

  static getSystemInstruction(): string {
    return this.SYSTEM_INSTRUCTION;
  }

  static getLocationLanguage(location: string): string {
    const languageMap: Record<string, string> = {
      'China': 'Chinese',
      'Germany': 'German',
      'France': 'French',
      'Japan': 'Japanese',
      'Korea': 'Korean',
      'Russia': 'Russian',
      'Spain': 'Spanish',
      'Italy': 'Italian',
      'Portugal': 'Portuguese',
      'Netherlands': 'Dutch',
      'Sweden': 'Swedish',
      'Norway': 'Norwegian',
      'Denmark': 'Danish',
      'Finland': 'Finnish',
      'Poland': 'Polish',
      'Turkey': 'Turkish',
      'Israel': 'Hebrew',
      'Arab': 'Arabic',
      'India': 'Hindi',
      'Brazil': 'Portuguese',
      'Mexico': 'Spanish',
      'Argentina': 'Spanish',
      'Chile': 'Spanish',
      'Colombia': 'Spanish',
      'Taiwan': 'Chinese',
      'Hong Kong': 'Chinese',
      'Macau': 'Chinese',
      'Singapore': 'Chinese',
      'Malaysia': 'Malay',
      'Indonesia': 'Indonesian',
      'Thailand': 'Thai',
      'Vietnam': 'Vietnamese',
      'Philippines': 'Filipino',
      'Greece': 'Greek',
      'Hungary': 'Hungarian',
      'Czech': 'Czech',
      'Slovakia': 'Slovak',
      'Romania': 'Romanian',
      'Bulgaria': 'Bulgarian',
      'Croatia': 'Croatian',
      'Serbia': 'Serbian',
      'Slovenia': 'Slovenian',
      'Bosnia': 'Bosnian',
      'Montenegro': 'Montenegrin',
      'Albania': 'Albanian',
      'Macedonia': 'Macedonian',
      'Estonia': 'Estonian',
      'Latvia': 'Latvian',
      'Lithuania': 'Lithuanian',
      'Ukraine': 'Ukrainian',
      'Belarus': 'Belarusian',
      'Moldova': 'Moldovan',
      'Georgia': 'Georgian',
      'Armenia': 'Armenian',
      'Azerbaijan': 'Azerbaijani',
      'Kazakhstan': 'Kazakh',
      'Uzbekistan': 'Uzbek',
      'Turkmenistan': 'Turkmen',
      'Kyrgyzstan': 'Kyrgyz',
      'Tajikistan': 'Tajik',
      'Afghanistan': 'Pashto',
      'Pakistan': 'Urdu',
      'Bangladesh': 'Bengali',
      'Sri Lanka': 'Sinhala',
      'Nepal': 'Nepali',
      'Bhutan': 'Dzongkha',
      'Maldives': 'Dhivehi',
      'Iran': 'Persian',
      'Iraq': 'Arabic',
      'Syria': 'Arabic',
      'Lebanon': 'Arabic',
      'Jordan': 'Arabic',
      'Egypt': 'Arabic',
      'Libya': 'Arabic',
      'Tunisia': 'Arabic',
      'Algeria': 'Arabic',
      'Morocco': 'Arabic',
      'Sudan': 'Arabic',
      'Ethiopia': 'Amharic',
      'Kenya': 'Swahili',
      'Tanzania': 'Swahili',
      'Uganda': 'Swahili',
      'Rwanda': 'Kinyarwanda',
      'Burundi': 'Kirundi',
      'Cameroon': 'French',
      'Nigeria': 'English',
      'Ghana': 'English',
      'Ivory Coast': 'French',
      'Senegal': 'French',
      'Mali': 'French',
      'Burkina Faso': 'French',
      'Niger': 'French',
      'Chad': 'French',
      'Central African Republic': 'French',
      'Congo': 'French',
      'Democratic Republic of Congo': 'French',
      'Gabon': 'French',
      'Equatorial Guinea': 'Spanish',
      'Angola': 'Portuguese',
      'Mozambique': 'Portuguese',
      'Zimbabwe': 'English',
      'Zambia': 'English',
      'Malawi': 'English',
      'Botswana': 'English',
      'Namibia': 'English',
      'South Africa': 'English',
      'Lesotho': 'English',
      'Swaziland': 'English',
      'Madagascar': 'Malagasy',
      'Mauritius': 'English',
      'Seychelles': 'English',
      'Comoros': 'Comorian',
      'Djibouti': 'Arabic',
      'Somalia': 'Somali',
      'Eritrea': 'Tigrinya',
      'Yemen': 'Arabic',
      'Oman': 'Arabic',
      'UAE': 'Arabic',
      'Saudi Arabia': 'Arabic',
      'Qatar': 'Arabic',
      'Kuwait': 'Arabic',
      'Bahrain': 'Arabic',
      'Venezuela': 'Spanish',
      'Ecuador': 'Spanish',
      'Peru': 'Spanish',
      'Bolivia': 'Spanish',
      'Paraguay': 'Spanish',
      'Uruguay': 'Spanish',
      'Guyana': 'English',
      'Suriname': 'Dutch',
      'French Guiana': 'French',
      'Costa Rica': 'Spanish',
      'Panama': 'Spanish',
      'Jamaica': 'English',
      'Trinidad and Tobago': 'English',
      'Barbados': 'English',
      'Bahamas': 'English',
      'Cuba': 'Spanish',
      'Haiti': 'French',
      'Dominican Republic': 'Spanish',
      'Puerto Rico': 'Spanish',
      'Guatemala': 'Spanish',
      'El Salvador': 'Spanish',
      'Honduras': 'Spanish',
      'Nicaragua': 'Spanish',
      'Belize': 'English',
      'Canada': 'English',
      'USA': 'English',
      'UK': 'English',
      'Ireland': 'English',
      'Australia': 'English',
      'New Zealand': 'English',
      'Fiji': 'English',
      'Papua New Guinea': 'English',
      'Solomon Islands': 'English',
      'Vanuatu': 'English',
      'Samoa': 'Samoan',
      'Tonga': 'Tongan',
      'Tuvalu': 'Tuvaluan',
      'Kiribati': 'Kiribati',
      'Marshall Islands': 'Marshallese',
      'Micronesia': 'English',
      'Palau': 'Palauan',
      'Nauru': 'Nauruan',
      'Worldwide': 'English'
    };

    return languageMap[location] || 'English';
  }
}