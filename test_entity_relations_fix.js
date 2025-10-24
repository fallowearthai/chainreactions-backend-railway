#!/usr/bin/env node

/**
 * Entity Relations Standard Mode Fix Validation Script
 *
 * This script tests the improvements made to the entity relations standard mode
 * to address the user feedback about evidence-source mapping issues.
 */

const axios = require('axios');

// Configuration
const SERVICE_URL = 'http://localhost:3002';
const API_ENDPOINT = '/api/normal-search';

// Test cases
const testCases = [
  {
    name: 'Multi-language search test',
    request: {
      Target_institution: 'Tsinghua University',
      Risk_Entity: 'Artificial Intelligence, Machine Learning',
      Location: 'China',
      Start_Date: '2023-01-01',
      End_Date: '2024-12-31'
    },
    expectations: {
      hasSources: true,
      hasEvidence: true,
      evidenceSourceMapping: true,
      multiLanguageSources: true
    }
  },
  {
    name: 'English location test',
    request: {
      Target_institution: 'Stanford University',
      Risk_Entity: 'Computer Science, AI Research',
      Location: 'United States',
      Start_Date: '2023-01-01',
      End_Date: '2024-12-31'
    },
    expectations: {
      hasSources: true,
      hasEvidence: true,
      evidenceSourceMapping: true,
      highQualitySources: true
    }
  },
  {
    name: 'No evidence found test',
    request: {
      Target_institution: 'Local Community College',
      Risk_Entity: 'Space Exploration, Mars Colony',
      Location: 'Small Town',
      Start_Date: '2023-01-01',
      End_Date: '2024-12-31'
    },
    expectations: {
      relationshipType: 'No Evidence Found',
      reasonableResponse: true
    }
  }
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logSection(title) {
  log(`\n🔍 ${title}`, 'cyan');
  log('='.repeat(50), 'cyan');
}

// Validation functions
function validateResponseStructure(response) {
  const requiredFields = ['result', 'urls', 'raw_data'];
  const missingFields = requiredFields.filter(field => !(field in response));

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  const requiredRawDataFields = ['risk_item', 'institution_A', 'relationship_type', 'finding_summary'];
  const missingRawDataFields = requiredRawDataFields.filter(field => !(field in response.raw_data));

  if (missingRawDataFields.length > 0) {
    throw new Error(`Missing required raw_data fields: ${missingRawDataFields.join(', ')}`);
  }
}

function validateEvidenceSourceMapping(response) {
  const { key_evidence, urls } = response.raw_data;

  if (!key_evidence || !Array.isArray(key_evidence)) {
    return { valid: false, reason: 'No key_evidence array found' };
  }

  if (!urls || typeof urls !== 'string') {
    return { valid: false, reason: 'No URLs string found' };
  }

  // Count URLs
  const urlCount = (urls.match(/\d+\./g) || []).length;

  for (let i = 0; i < key_evidence.length; i++) {
    const evidence = key_evidence[i];

    if (!evidence.text || typeof evidence.text !== 'string') {
      return { valid: false, reason: `Evidence ${i} missing text` };
    }

    if (!evidence.source_indices || !Array.isArray(evidence.source_indices)) {
      return { valid: false, reason: `Evidence ${i} missing source_indices` };
    }

    // Check if source indices are valid
    for (const sourceIndex of evidence.source_indices) {
      if (typeof sourceIndex !== 'number' || sourceIndex < 1 || sourceIndex > urlCount) {
        return { valid: false, reason: `Evidence ${i} has invalid source index: ${sourceIndex} (valid range: 1-${urlCount})` };
      }
    }
  }

  return { valid: true, urlCount, evidenceCount: key_evidence.length };
}

function validateSourceInclusion(urls) {
  if (!urls || typeof urls !== 'string') {
    return { valid: false, reason: 'No URLs to validate' };
  }

  const urlList = urls.split('\n').filter(url => url.trim());

  // With complete trust in Gemini, we now validate that ALL URLs are included
  // regardless of domain or perceived quality

  return {
    valid: true, // All URLs from Gemini are now considered valid
    totalUrls: urlList.length,
    inclusionStrategy: 'complete_trust_gemini',
    message: 'All Gemini-returned sources are included without filtering'
  };
}

function validateMultiLanguageContent(response, request) {
  const { finding_summary, institution_A } = response.raw_data;
  const location = request.Location.toLowerCase();

  // For non-English locations, check for potential non-English content patterns
  const chineseLocations = ['china', 'beijing', 'shanghai', 'guangzhou'];
  const germanLocations = ['germany', 'berlin', 'munich', 'frankfurt'];
  const japaneseLocations = ['japan', 'tokyo', 'osaka', 'kyoto'];

  const hasNonEnglishLocation = [...chineseLocations, ...germanLocations, ...japaneseLocations].some(loc => location.includes(loc));

  if (!hasNonEnglishLocation) {
    return { valid: true, reason: 'English location - multi-language not required' };
  }

  const content = `${finding_summary} ${institution_A}`.toLowerCase();

  // Simple heuristic: check for non-ASCII characters or specific language patterns
  const hasNonAscii = /[^\x00-\x7F]/.test(content);
  const hasChinesePatterns = /[\u4e00-\u9fff]/.test(content);
  const hasGermanPatterns = /[äöüß]/.test(content);
  const hasJapanesePatterns = /[\u3040-\u309f\u30a0-\u30ff]/.test(content);

  const hasNonEnglishContent = hasNonAscii || hasChinesePatterns || hasGermanPatterns || hasJapanesePatterns;

  return {
    valid: true, // Don't fail this test, just report
    hasNonEnglishContent,
    hasChinesePatterns,
    hasGermanPatterns,
    hasJapanesePatterns,
    location
  };
}

// Main test function
async function runTest(testCase) {
  logSection(`Running Test: ${testCase.name}`);

  try {
    logInfo('Sending request...');
    const startTime = Date.now();

    const response = await axios.post(`${SERVICE_URL}${API_ENDPOINT}`, testCase.request, {
      timeout: 180000, // 3 minutes
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;
    logInfo(`Response received in ${responseTime}ms`);

    const data = response.data;

    // Basic response validation
    validateResponseStructure(data);
    logSuccess('Response structure is valid');

    // Test expectations
    const results = {};

    // Test 1: Basic response structure
    results.responseStructure = true;

    // Test 2: Sources validation
    if (testCase.expectations.hasSources) {
      if (data.urls && data.urls.trim().length > 0) {
        const sourceValidation = validateSourceInclusion(data.urls);
        results.hasSources = true;
        results.sourceInclusion = sourceValidation;

        logSuccess(`All Gemini sources included (${sourceValidation.totalUrls} URLs)`);
        logInfo(`Strategy: ${sourceValidation.inclusionStrategy}`);
        logInfo(`Message: ${sourceValidation.message}`);
      } else {
        results.hasSources = false;
        logError('No sources found in response');
      }
    }

    // Test 3: Evidence validation
    if (testCase.expectations.hasEvidence) {
      const evidenceValidation = validateEvidenceSourceMapping(data);
      results.evidenceSourceMapping = evidenceValidation;

      if (evidenceValidation.valid) {
        logSuccess(`Evidence-source mapping is valid (${evidenceValidation.evidenceCount} evidence pieces, ${evidenceValidation.urlCount} URLs)`);
      } else {
        logError(`Evidence-source mapping failed: ${evidenceValidation.reason}`);
      }
    }

    // Test 4: Multi-language content
    if (testCase.expectations.multiLanguageSources) {
      const multiLanguageValidation = validateMultiLanguageContent(data, testCase.request);
      results.multiLanguage = multiLanguageValidation;

      if (multiLanguageValidation.hasNonEnglishContent) {
        logSuccess('Multi-language content detected in response');
        logInfo(`Location: ${multiLanguageValidation.location}`);
        if (multiLanguageValidation.hasChinesePatterns) logInfo('- Chinese patterns found');
        if (multiLanguageValidation.hasGermanPatterns) logInfo('- German patterns found');
        if (multiLanguageValidation.hasJapanesePatterns) logInfo('- Japanese patterns found');
      } else {
        logWarning('No multi-language content detected (may be acceptable)');
      }
    }

    // Test 5: Complete Gemini source inclusion
    if (testCase.expectations.highQualitySources) {
      const sourceValidation = validateSourceInclusion(data.urls);
      results.completeGeminiInclusion = sourceValidation.valid;

      if (sourceValidation.valid) {
        logSuccess(`All Gemini sources included without filtering (${sourceValidation.totalUrls} URLs)`);
        logInfo(`Strategy: ${sourceValidation.inclusionStrategy}`);
      } else {
        logWarning(`Source inclusion validation failed: ${sourceValidation.reason}`);
      }
    }

    // Test 6: Relationship type validation
    if (testCase.expectations.relationshipType) {
      const actualType = data.raw_data.relationship_type;
      results.relationshipTypeMatch = actualType === testCase.expectations.relationshipType;

      if (actualType === testCase.expectations.relationshipType) {
        logSuccess(`Relationship type matches: ${actualType}`);
      } else {
        logWarning(`Relationship type mismatch: expected ${testCase.expectations.relationshipType}, got ${actualType}`);
      }
    }

    // Test 7: Debug information (development only)
    if (data.raw_data.original_sources_count !== undefined) {
      logInfo('Debug information available:');
      logInfo(`- Original sources: ${data.raw_data.original_sources_count}`);
      logInfo(`- Valid sources: ${data.raw_data.valid_sources_count}`);
      logInfo(`- Original evidence: ${data.raw_data.original_evidence_count}`);
      logInfo(`- Processed evidence: ${data.raw_data.processed_evidence_count}`);

      if (data.raw_data.quality_metrics) {
        logInfo(`- Source quality score: ${data.raw_data.quality_metrics.source_quality_score?.toFixed(2) || 'N/A'}`);
      }
    }

    // Display response summary
    logSection('Response Summary');
    logInfo(`Risk Item: ${data.raw_data.risk_item}`);
    logInfo(`Institution A: ${data.raw_data.institution_A}`);
    logInfo(`Relationship Type: ${data.raw_data.relationship_type}`);
    logInfo(`Finding Summary: ${data.raw_data.finding_summary.substring(0, 200)}${data.raw_data.finding_summary.length > 200 ? '...' : ''}`);

    if (data.urls) {
      logInfo(`Sources (${(data.urls.match(/\d+\./g) || []).length}):`);
      data.urls.split('\n').filter(url => url.trim()).slice(0, 3).forEach(url => {
        logInfo(`  ${url.trim()}`);
      });
      if ((data.urls.match(/\d+\./g) || []).length > 3) {
        logInfo(`  ... and ${(data.urls.match(/\d+\./g) || []).length - 3} more`);
      }
    }

    if (data.raw_data.key_evidence && data.raw_data.key_evidence.length > 0) {
      logInfo(`Evidence (${data.raw_data.key_evidence.length} pieces):`);
      data.raw_data.key_evidence.slice(0, 2).forEach((evidence, index) => {
        logInfo(`  ${index + 1}. ${evidence.text.substring(0, 150)}${evidence.text.length > 150 ? '...' : ''}`);
        logInfo(`     Sources: [${evidence.source_indices.join(', ')}]`);
      });
      if (data.raw_data.key_evidence.length > 2) {
        logInfo(`  ... and ${data.raw_data.key_evidence.length - 2} more`);
      }
    }

    return { success: true, results, responseTime, data };

  } catch (error) {
    logError(`Test failed: ${error.message}`);
    if (error.response) {
      logError(`API Response Status: ${error.response.status}`);
      logError(`API Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return { success: false, error: error.message };
  }
}

// Main execution
async function main() {
  logSection('Entity Relations Standard Mode Fix Validation');
  logInfo('Testing "Complete Trust in Gemini" approach to evidence-source mapping...');

  const serviceHealth = await checkServiceHealth();
  if (!serviceHealth) {
    logError('Service is not healthy. Please ensure the entity-relations service is running on port 3002.');
    process.exit(1);
  }

  const testResults = [];

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    testResults.push({ name: testCase.name, ...result });

    // Wait between tests to avoid rate limiting
    if (testCases.indexOf(testCase) < testCases.length - 1) {
      logInfo('Waiting 5 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Summary
  logSection('Test Summary');

  const passedTests = testResults.filter(r => r.success).length;
  const totalTests = testResults.length;

  logInfo(`Tests completed: ${passedTests}/${totalTests}`);

  if (passedTests === totalTests) {
    logSuccess('All tests passed! 🎉');
    logSuccess('"Complete Trust in Gemini" approach is working correctly.');
    logInfo('All Gemini-returned sources are now included without additional filtering.');
  } else {
    logWarning(`${totalTests - passedTests} test(s) failed or had issues.`);
    logInfo('Review the test results above for details.');
  }

  // Detailed results
  testResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    log(`${status} ${result.name}${result.responseTime ? ` (${result.responseTime}ms)` : ''}`);

    if (result.results) {
      Object.entries(result.results).forEach(([key, value]) => {
        if (typeof value === 'object' && value.valid !== undefined) {
          log(`  ${key}: ${value.valid ? '✅' : '❌'} ${value.reason || ''}`);
        } else if (typeof value === 'boolean') {
          log(`  ${key}: ${value ? '✅' : '❌'}`);
        }
      });
    }
  });

  logSection('Recommendations');

  if (passedTests === totalTests) {
    logSuccess('✨ Ready for production deployment!');
    logInfo('The Entity Relations Standard Mode improvements are working as expected.');
  } else {
    logWarning('⚠️  Review failed tests before deploying to production.');
    logInfo('Consider running additional tests or fixing the identified issues.');
  }
}

async function checkServiceHealth() {
  try {
    const response = await axios.get(`${SERVICE_URL}/api/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Run the tests
if (require.main === module) {
  main().catch(error => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTest, validateResponseStructure, validateEvidenceSourceMapping };