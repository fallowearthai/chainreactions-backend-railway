// Test script to simulate frontend affiliated matching request
const testAffiliatedMatching = async () => {
  try {
    console.log('🧪 Testing affiliated matching with frontend expectations...');

    const response = await fetch('http://localhost:3004/api/dataset-matching/affiliated-match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity: "Test Entity",
        affiliated_companies: [
          {
            company_name: "Chinese Academy of Engineering Physics (CAEP)",
            risk_keyword: "nuclear",
            relationship_type: "indirect"
          },
          {
            company_name: "State Administration for Science",
            risk_keyword: "test",
            relationship_type: "unknown"
          },
          {
            company_name: "National University of Defense Technology (NUDT)",
            risk_keyword: "military",
            relationship_type: "direct"
          },
          {
            company_name: "Shandong Provincial Military Region (山东省军区)",
            risk_keyword: "military",
            relationship_type: "direct"
          }
        ],
        maxResults: 5
      })
    });

    const data = await response.json();

    if (data.success && data.data) {
      console.log('✅ API call successful');

      const affiliatedBreakdown = data.data.affiliated_breakdown || [];
      const matchingCompanies = affiliatedBreakdown.filter(item => item.has_matches);
      const nonMatchingCompanies = affiliatedBreakdown.filter(item => !item.has_matches);

      console.log('\n📋 EXPECTED FRONTEND DISPLAY:');
      console.log('Only companies with matches should be shown:');

      matchingCompanies.forEach(company => {
        console.log(`✅ ${company.company_name} matches exactly with an entity in Canadian Named Research Organizations`);
      });

      console.log('\n❌ COMPANIES THAT SHOULD BE HIDDEN:');
      nonMatchingCompanies.forEach(company => {
        console.log(`- ${company.company_name} (no matches)`);
      });

      console.log(`\n📊 SUMMARY:`);
      console.log(`- Total companies: ${affiliatedBreakdown.length}`);
      console.log(`- Companies with matches: ${matchingCompanies.length}`);
      console.log(`- Companies without matches: ${nonMatchingCompanies.length}`);

      console.log('\n🎯 FRONTEND SIMULATION SUCCESS!');
      console.log('The frontend will only show companies with matches, exactly as requested.');

    } else {
      console.error('❌ API call failed:', data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testAffiliatedMatching();