"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const StandardSearchController_1 = require("../services/entity-relations/src/controllers/StandardSearchController");
const DeepThinkingSearchController_1 = require("../services/entity-relations/src/controllers/DeepThinkingSearchController");
// Controller parsing demonstration using existing raw response files
async function demonstrateControllerParsing() {
    console.log('🔍 Starting Controller Parsing Demonstration\n');
    // Initialize controllers
    const standardController = new StandardSearchController_1.StandardSearchController();
    const deepthinkingController = new DeepThinkingSearchController_1.DeepThinkingSearchController();
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
        console.log('🔄 Processing Standard Search with StandardSearchController...');
        // Extract the parsed JSON from the raw response (this is what GeminiService.verifyCompanyEntity would return)
        let standardSearchParsed;
        try {
            // Find the text content in the response parts
            const response = standardSearchRaw.response.data;
            if (response.candidates && response.candidates[0]?.content?.parts) {
                const parts = response.candidates[0].content.parts;
                const textPart = parts.find((part) => part.text && part.text.trim().length > 0);
                if (textPart?.text) {
                    let jsonText = textPart.text.trim();
                    // Remove markdown code blocks
                    if (jsonText.startsWith('```json')) {
                        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                    }
                    else if (jsonText.startsWith('```')) {
                        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
                    }
                    standardSearchParsed = JSON.parse(jsonText);
                    console.log('✅ Extracted JSON from Standard Search raw response');
                }
            }
        }
        catch (error) {
            console.error('❌ Failed to parse Standard Search response:', error);
            return;
        }
        // --- DeepThinking Search Processing ---
        console.log('🔄 Processing DeepThinking Search with DeepThinkingSearchController...');
        // Extract the parsed JSON from the raw response (this is what GeminiDeepThinkingService.executeSearch would return)
        let deepthinkingSearchParsed;
        try {
            // The DeepThinking response structure is different - it contains enhanced search results
            const response = deepthinkingSearchRaw.response.data;
            if (response.candidates && response.candidates[0]?.content?.parts) {
                const parts = response.candidates[0].content.parts;
                const textPart = parts.find((part) => part.text && part.text.trim().length > 0);
                if (textPart?.text) {
                    let jsonText = textPart.text.trim();
                    // Remove markdown code blocks
                    if (jsonText.startsWith('```json')) {
                        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                    }
                    else if (jsonText.startsWith('```')) {
                        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
                    }
                    const parsedResults = JSON.parse(jsonText);
                    // DeepThinkingService returns { results: [...] } structure
                    deepthinkingSearchParsed = parsedResults.results ? parsedResults.results[0] : parsedResults;
                    console.log('✅ Extracted JSON from DeepThinking Search raw response');
                }
            }
        }
        catch (error) {
            console.error('❌ Failed to parse DeepThinking Search response:', error);
            return;
        }
        console.log('\n📊 Applying controller formatting...\n');
        // Use existing controller formatting methods
        // Simulate the processing time that would be measured by controllers
        const standardProcessingTime = 15340; // From actual log
        const deepthinkingProcessingTime = 29198; // From actual log
        // Apply StandardSearchController formatting
        const standardSearchResult = standardController['formatOptimizedSearchResults'](standardSearchParsed, standardProcessingTime);
        // Apply DeepThinkingSearchController formatting
        const deepthinkingSearchResult = deepthinkingController['formatOptimizedSearchResults'](deepthinkingSearchParsed, deepthinkingProcessingTime);
        console.log('✅ Standard Search formatted by StandardSearchController');
        console.log('✅ DeepThinking Search formatted by DeepThinkingSearchController\n');
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
    }
    catch (error) {
        console.error('❌ Demonstration failed:', error);
    }
}
// Run the demonstration
demonstrateControllerParsing();
