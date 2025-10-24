// Test script that simulates exactly what the frontend DatasetMatchingDropdown does
const testFrontendSimulation = async () => {
  try {
    console.log('🧪 Simulating frontend DatasetMatchingDropdown behavior...');

    // This simulates exactly what the frontend should send
    const requestPayload = {
      entity: "Intermediary B - 3", // Clean entity name (no prefix)
      location: undefined,
      affiliated_companies: [
        {
          company_name: "National University of Defense Technology (NUDT)",
          risk_keyword: "intermediary",
          relationship_type: "Unknown"
        }
      ],
      options: {
        affiliatedBoost: 1.0,
        minConfidence: 0.1,
        maxResults: 10,
        forceRefresh: true  // Force refresh to avoid cache
      }
    };

    console.log('📤 REQUEST PAYLOAD:', JSON.stringify(requestPayload, null, 2));

    const response = await fetch('http://localhost:3004/api/dataset-matching/affiliated-match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    });

    const data = await response.json();

    if (data.success && data.data) {
      console.log('✅ API call successful');
      console.log('📥 RESPONSE DATA:', JSON.stringify(data, null, 2));

      // Check if the response structure matches what frontend expects
      const affiliatedBreakdown = data.data.affiliated_breakdown || [];
      const matchingCompanies = affiliatedBreakdown.filter(item => item.has_matches);

      console.log('\n🎯 FRONTEND DISPLAY SIMULATION:');
      console.log('🔍 Checking affiliated_breakdown structure...');

      affiliatedBreakdown.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, {
          company_name: item.company_name,
          has_matches: item.has_matches,
          match_count: item.match_count,
          top_confidence: item.top_confidence
        });
      });

      console.log('\n📋 What frontend SHOULD display:');
      if (matchingCompanies.length > 0) {
        matchingCompanies.forEach(company => {
          console.log(`✅ ${company.company_name} matches exactly with an entity in Canadian Named Research Organizations`);
        });
      } else {
        console.log('❌ No companies with matches - frontend should show nothing');
      }

      console.log('\n📊 SUMMARY:');
      console.log(`- Total affiliated_breakdown items: ${affiliatedBreakdown.length}`);
      console.log(`- Companies with has_matches=true: ${matchingCompanies.length}`);
      console.log(`- Companies with has_matches=false: ${affiliatedBreakdown.length - matchingCompanies.length}`);

      // Check for NUDT specifically
      const nudtResult = affiliatedBreakdown.find(item =>
        item.company_name.includes('NUDT') || item.company_name.includes('National University of Defense Technology')
      );

      if (nudtResult) {
        console.log('\n🎯 NUDT SPECIFIC RESULT:');
        console.log(`- Company: ${nudtResult.company_name}`);
        console.log(`- Has matches: ${nudtResult.has_matches}`);
        console.log(`- Match count: ${nudtResult.match_count}`);
        console.log(`- Top confidence: ${nudtResult.top_confidence}`);
        console.log(`- Frontend display: ${nudtResult.has_matches ? 'SHOW' : 'HIDE'}`);
      } else {
        console.log('\n❌ NUDT not found in affiliated_breakdown!');
      }

    } else {
      console.error('❌ API call failed:', data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testFrontendSimulation();