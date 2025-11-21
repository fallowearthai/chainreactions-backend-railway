const fs = require('fs');
const path = require('path');

// Controller parsing demonstration using existing raw response files
async function demonstrateControllerParsing() {
  console.log('🔍 Starting Controller Parsing Demonstration\n');

  try {
    // Load raw response files
    const standardSearchRawFile = '/Users/kanbei/Code/chainreactions_backend/test/gemini_raw_response_2025-11-16T06-06-30-017Z.json';
    const deepthinkingSearchRawFile = '/Users/kanbei/Code/chainreactions_backend/test/gemini_raw_response_2025-11-16T06-07-09-722Z.json';

    console.log('📁 Loading raw response files...');

    const standardSearchRaw = JSON.parse(fs.readFileSync(standardSearchRawFile, 'utf8'));
    const deepthinkingSearchRaw = JSON.parse(fs.readFileSync(deepthinkingSearchRawFile, 'utf8'));

    console.log(`✅ Standard Search raw response loaded: ${standardSearchRawFile}`);
    console.log(`✅ DeepThinking Search raw response loaded: ${deepthinkingSearchRawFile}\n`);

    // --- Standard Search Processing ---
    console.log('🔄 Processing Standard Search response...');

    let standardSearchParsed;
    try {
      // Extract the JSON from the response parts (what GeminiService.verifyCompanyEntity returns)
      const response = standardSearchRaw.response.data;
      if (response.candidates && response.candidates[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        const textPart = parts.find(part => part.text && part.text.trim().length > 0);

        if (textPart?.text) {
          let jsonText = textPart.text.trim();

          // Remove markdown code blocks (same logic as GeminiService)
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          standardSearchParsed = JSON.parse(jsonText);
          console.log('✅ Extracted JSON from Standard Search raw response');
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse Standard Search response:', error);
      return;
    }

    // --- DeepThinking Search Processing ---
    console.log('🔄 Processing DeepThinking Search response...');

    let deepthinkingSearchParsed;
    try {
      const response = deepthinkingSearchRaw.response.data;

      if (response.candidates && response.candidates[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        const textPart = parts.find(part => part.text && part.text.trim().length > 0);

        if (textPart?.text) {
          let jsonText = textPart.text.trim();

          // Remove markdown code blocks (same logic as GeminiDeepThinkingService)
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          const parsedResults = JSON.parse(jsonText);
          // DeepThinkingService returns { results: [...] } structure
          deepthinkingSearchParsed = parsedResults.results ? parsedResults.results[0] : parsedResults;
          console.log('✅ Extracted JSON from DeepThinking Search raw response');
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse DeepThinking Search response:', error);
      return;
    }

    console.log('\n📊 Applying Optimized Format v2.1.0 (same as both controllers)...\n');

    // Apply the same formatting logic that both controllers use
    const standardProcessingTime = 15340; // From actual log
    const deepthinkingProcessingTime = 29198; // From actual log

    // Optimized format formatter (same logic from both controllers)
    function formatOptimizedSearchResults(result, processingTime) {
      // Handle intermediary_B array conversion to string
      let intermediaryString = 'None';
      if (Array.isArray(result.potential_intermediary_B) && result.potential_intermediary_B.length > 0) {
        intermediaryString = result.potential_intermediary_B.join(', ');
      } else if (typeof result.potential_intermediary_B === 'string' && result.potential_intermediary_B) {
        intermediaryString = result.potential_intermediary_B;
      }

      // Create empty sources and key_evidence arrays (frontend uses grounding metadata)
      const sources = [];
      const processedKeyEvidence = [];

      // Create quality metrics (simplified)
      const qualityMetrics = {
        evidence_count: 0,
        source_count: 0,
        coverage_percentage: 0,
        source_quality_score: result.quality_metrics?.source_quality_score
      };

      return {
        version: '2.1.0',
        success: true,
        data: {
          // Core business data
          risk_item: result.risk_item,
          institution_A: result.institution_A,
          relationship_type: result.relationship_type,
          finding_summary: result.finding_summary,
          potential_intermediary_B: intermediaryString,

          // Source data information (empty - frontend uses grounding metadata)
          sources: sources,
          sources_count: 0,

          // Key evidence (empty - frontend uses inline citations)
          key_evidence: processedKeyEvidence,

          // Quality metrics
          quality_metrics: qualityMetrics,

          // Grounding metadata (critical for inline citations)
          grounding_metadata: result.grounding_metadata
        },

        // Metadata
        metadata: {
          timestamp: new Date().toISOString(),
          processing_time_ms: processingTime,
          enhanced_mode: false,
          api_version: '1.0.0'
        }
      };
    }

    // Apply formatting (handle array structure)
    const standardSearchResult = formatOptimizedSearchResults(standardSearchParsed[0], standardProcessingTime);
    const deepthinkingSearchResult = formatOptimizedSearchResults(deepthinkingSearchParsed[0], deepthinkingProcessingTime);

    console.log('✅ Standard Search formatted with Optimized Format v2.1.0');
    console.log('✅ DeepThinking Search formatted with Optimized Format v2.1.0\n');

    // Save results to files
    const outputDir = '/Users/kanbei/Code/chainreactions_backend/test';

    const standardSearchOutputFile = path.join(outputDir, 'standard_search_controller_result.json');
    const deepthinkingSearchOutputFile = path.join(outputDir, 'deepthinking_search_controller_result.json');

    // Create comprehensive output showing the complete controller processing
    const standardOutput = {
      controller: 'StandardSearchController',
      service: 'GeminiService',
      model: 'gemini-2.5-flash',
      processing_time_ms: standardProcessingTime,
      raw_data: standardSearchParsed,
      formatted_result: standardSearchResult,
      timestamp: new Date().toISOString()
    };

    const deepthinkingOutput = {
      controller: 'DeepThinkingSearchController',
      service: 'GeminiDeepThinkingService',
      model: 'gemini-2.5-pro',
      processing_time_ms: deepthinkingProcessingTime,
      raw_data: deepthinkingSearchParsed,
      formatted_result: deepthinkingSearchResult,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(standardSearchOutputFile, JSON.stringify(standardOutput, null, 2));
    fs.writeFileSync(deepthinkingSearchOutputFile, JSON.stringify(deepthinkingOutput, null, 2));

    console.log('💾 Results saved:');
    console.log(`   Standard Search: ${standardSearchOutputFile}`);
    console.log(`   DeepThinking Search: ${deepthinkingSearchOutputFile}\n`);

    // Display summary comparison
    console.log('📋 Results Summary:');
    console.log('Standard Search Controller:');
    console.log(`  - Risk Item: ${standardSearchResult.data.risk_item}`);
    console.log(`  - Institution A: ${standardSearchResult.data.institution_A}`);
    console.log(`  - Relationship Type: ${standardSearchResult.data.relationship_type}`);
    console.log(`  - Finding Summary: ${standardSearchResult.data.finding_summary.substring(0, 100)}...`);
    console.log(`  - Processing Time: ${standardSearchResult.metadata.processing_time_ms}ms\n`);

    console.log('DeepThinking Search Controller:');
    console.log(`  - Risk Item: ${deepthinkingSearchResult.data.risk_item}`);
    console.log(`  - Institution A: ${deepthinkingSearchResult.data.institution_A}`);
    console.log(`  - Relationship Type: ${deepthinkingSearchResult.data.relationship_type}`);
    console.log(`  - Finding Summary: ${deepthinkingSearchResult.data.finding_summary.substring(0, 100)}...`);
    console.log(`  - Processing Time: ${deepthinkingSearchResult.metadata.processing_time_ms}ms\n`);

    console.log('🎉 Controller parsing demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Demonstration failed:', error);
  }
}

// Run the demonstration
demonstrateControllerParsing();