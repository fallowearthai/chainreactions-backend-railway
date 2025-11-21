import { GeminiService } from './services/entity-relations/src/services/GeminiService';
import dotenv from 'dotenv';

// Load environment variables from entity-relations directory
dotenv.config({ path: './services/entity-relations/.env' });

async function testGeminiRawResponse() {
  console.log('🔍 Testing GeminiService.verifyCompanyEntity with raw response...');

  const geminiService = new GeminiService();

  const testCase = {
    companyName: "南京大学",
    targetInstitution: "江苏省中医院",
    location: "China"
  };

  console.log('📝 Test Case:', testCase);
  console.log('⏱️ Starting Gemini API call...');

  const startTime = Date.now();

  try {
    const rawResponse = await geminiService.verifyCompanyEntity(
      testCase.companyName,
      testCase.location,
      testCase.targetInstitution
    );

    const elapsedTime = Date.now() - startTime;

    console.log(`✅ Gemini API responded in ${elapsedTime}ms`);
    console.log('📄 Raw Response Structure:');
    console.log(JSON.stringify(rawResponse, null, 2));

    // Save raw response to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `gemini_raw_response_${timestamp}.json`;

    const fs = require('fs');
    fs.writeFileSync(`./test/${fileName}`, JSON.stringify(rawResponse, null, 2));

    console.log(`💾 Raw response saved to: ./test/${fileName}`);
    console.log(`📊 Response size: ${JSON.stringify(rawResponse).length} characters`);

    // Quick analysis
    console.log('\n🔍 Quick Analysis:');
    console.log('- Entity A verified:', !!rawResponse.entity_a?.original_name);
    console.log('- Entity B verified:', !!rawResponse.entity_b?.original_name);
    console.log('- Search strategy present:', !!rawResponse.search_strategy);
    console.log('- Relationship likelihood:', rawResponse.search_strategy?.relationship_likelihood);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testGeminiRawResponse().catch(console.error);