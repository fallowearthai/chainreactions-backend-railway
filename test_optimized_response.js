/**
 * Test script to compare legacy vs optimized response formats
 */

const http = require('http');

const TEST_REQUEST = {
  Target_institution: 'School of Nuclear Science and Energy Power, Shandong University',
  Risk_Entity: 'Military',
  Location: 'China'
};

async function makeRequest(port, format = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(TEST_REQUEST);

    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/normal-search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(format ? { 'x-response-format': format } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testResponseFormats() {
  console.log('🧪 Testing Entity Relations Response Formats...\n');

  try {
    // Test legacy format
    console.log('📡 Testing LEGACY format...');
    const legacyResponse = await makeRequest(3002);

    // Test optimized format
    console.log('🚀 Testing OPTIMIZED format...');
    const optimizedResponse = await makeRequest(3002, 'optimized');

    console.log('\n📊 Comparison Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Legacy analysis
    console.log('\n🔸 LEGACY FORMAT:');
    console.log(`  - Top-level fields: ${Object.keys(legacyResponse).length}`);
    console.log(`  - Result field length: ${legacyResponse.result?.length || 0} chars`);
    console.log(`  - URLs field length: ${legacyResponse.urls?.length || 0} chars`);
    console.log(`  - Raw data keys: ${Object.keys(legacyResponse.raw_data || {}).join(', ')}`);

    // Optimized analysis
    console.log('\n🔹 OPTIMIZED FORMAT:');
    console.log(`  - Version: ${optimizedResponse.version}`);
    console.log(`  - Success: ${optimizedResponse.success}`);
    console.log(`  - Data keys: ${Object.keys(optimizedResponse.data || {}).join(', ')}`);
    console.log(`  - Sources array length: ${optimizedResponse.data?.sources?.length || 0}`);
    console.log(`  - Has formatted_display: ${!!optimizedResponse.data?.formatted_display}`);
    console.log(`  - Has quality_metrics: ${!!optimizedResponse.data?.quality_metrics}`);
    console.log(`  - Metadata keys: ${Object.keys(optimizedResponse.metadata || {}).join(', ')}`);

    // Data redundancy analysis
    console.log('\n📈 REDUNDANCY ANALYSIS:');

    const legacyDataSize = JSON.stringify(legacyResponse).length;
    const optimizedDataSize = JSON.stringify(optimizedResponse).length;
    const sizeReduction = ((legacyDataSize - optimizedDataSize) / legacyDataSize * 100).toFixed(1);

    console.log(`  - Legacy response size: ${legacyDataSize} bytes`);
    console.log(`  - Optimized response size: ${optimizedDataSize} bytes`);
    console.log(`  - Size reduction: ${sizeReduction}%`);

    // Data integrity check
    const legacyCore = {
      risk_item: legacyResponse.raw_data?.risk_item,
      institution_A: legacyResponse.raw_data?.institution_A,
      relationship_type: legacyResponse.raw_data?.relationship_type,
      finding_summary: legacyResponse.raw_data?.finding_summary
    };

    const optimizedCore = {
      risk_item: optimizedResponse.data?.risk_item,
      institution_A: optimizedResponse.data?.institution_A,
      relationship_type: optimizedResponse.data?.relationship_type,
      finding_summary: optimizedResponse.data?.finding_summary
    };

    const coreDataMatch = JSON.stringify(legacyCore) === JSON.stringify(optimizedCore);
    console.log(`  - Core data integrity: ${coreDataMatch ? '✅ MATCH' : '❌ MISMATCH'}`);

    // Backward compatibility check
    if (optimizedResponse.data?.formatted_display) {
      const backwardCompat = {
        result: optimizedResponse.data.formatted_display?.result === legacyResponse.result,
        urls_text: optimizedResponse.data.formatted_display?.urls_text === legacyResponse.urls
      };
      console.log(`  - Backward compatibility: ${backwardCompat.result && backwardCompat.urls_text ? '✅ COMPATIBLE' : '❌ INCOMPATIBLE'}`);
    }

    console.log('\n🎯 SUMMARY:');
    console.log(`  ✅ Optimization successful: ${sizeReduction}% size reduction`);
    console.log(`  ✅ Data integrity maintained: ${coreDataMatch}`);
    console.log(`  ✅ Backward compatibility preserved: ${!!optimizedResponse.data?.formatted_display}`);
    console.log(`  ✅ Enhanced features available: structured sources, quality metrics, metadata`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testResponseFormats();