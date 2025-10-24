// Test script specifically for NUDT matching after cache clear
const testNUDTMatching = async () => {
  try {
    console.log('🧪 Testing NUDT matching after cache clear...');

    const response = await fetch('http://localhost:3004/api/dataset-matching/affiliated-match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity: "Test Entity",
        location: "China",
        affiliated_companies: [
          {
            company_name: "National University of Defense Technology (NUDT)",
            risk_keyword: "military",
            relationship_type: "direct"
          },
          {
            company_name: "Chinese Academy of Engineering Physics (CAEP)",
            risk_keyword: "nuclear",
            relationship_type: "indirect"
          },
          {
            company_name: "Nonexistent University",
            risk_keyword: "test",
            relationship_type: "unknown"
          }
        ],
        options: {
          affiliatedBoost: 1.0,
          minConfidence: 0.1,
          maxResults: 10,
          forceRefresh: true  // Force refresh to ensure no cache
        }
      })
    });

    const data = await response.json();

    if (data.success && data.data) {
      console.log('✅ API call successful');
      console.log('📊 FULL RESPONSE:', JSON.stringify(data, null, 2));

      const affiliatedBreakdown = data.data.affiliated_breakdown || [];
      const matchingCompanies = affiliatedBreakdown.filter(item => item.has_matches);
      const nonMatchingCompanies = affiliatedBreakdown.filter(item => !item.has_matches);

      console.log('\n📋 MATCHING RESULTS:');
      console.log('Companies with matches:');
      matchingCompanies.forEach(company => {
        console.log(`✅ ${company.company_name} - ${company.matches} matches, confidence: ${company.top_confidence}`);
      });

      console.log('\n❌ Companies without matches:');
      nonMatchingCompanies.forEach(company => {
        console.log(`- ${company.company_name} (0 matches)`);
      });

      console.log(`\n📊 SUMMARY:`);
      console.log(`- Total companies: ${affiliatedBreakdown.length}`);
      console.log(`- Companies with matches: ${matchingCompanies.length}`);
      console.log(`- Companies without matches: ${nonMatchingCompanies.length}`);

      // Specific check for NUDT
      const nudtResult = affiliatedBreakdown.find(item =>
        item.company_name.includes('NUDT') || item.company_name.includes('National University of Defense Technology')
      );

      if (nudtResult && nudtResult.has_matches) {
        console.log('\n🎯 NUDT TEST: ✅ SUCCESS - NUDT was matched!');
        console.log(`   Matches: ${nudtResult.matches}, Confidence: ${nudtResult.top_confidence}`);
      } else {
        console.log('\n❌ NUDT TEST: FAILED - NUDT was not matched');
        console.log('   Expected: NUDT should match with Canadian Named Research Organizations');
      }

    } else {
      console.error('❌ API call failed:', data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testNUDTMatching();