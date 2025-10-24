// Final verification test to ensure the complete solution works
const testFinalVerification = async () => {
  console.log('🎯 FINAL VERIFICATION TEST');
  console.log('==========================');

  // Test 1: Direct API test (already verified to work)
  console.log('\n1️⃣ Testing direct API call...');

  const directTestPayload = {
    entity: "Test Entity",
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
      forceRefresh: true
    }
  };

  const directResponse = await fetch('http://localhost:3004/api/dataset-matching/affiliated-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(directTestPayload)
  });

  const directData = await directResponse.json();
  const nuditMatches = directData.data?.affiliated_breakdown?.filter(item => item.has_matches) || [];

  console.log(`   NUDT API Test: ${nuditMatches.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
  if (nuditMatches.length > 0) {
    console.log(`   - NUDT matches: ${nuditMatches[0].match_count}, confidence: ${nuditMatches[0].top_confidence}`);
  }

  // Test 2: Check that response structure matches frontend expectations
  console.log('\n2️⃣ Checking response structure...');

  const requiredFields = [
    'success',
    'data.match_summary.total_affiliated_matches',
    'data.affiliated_breakdown',
    'data.affiliated_breakdown[0].has_matches',
    'data.affiliated_breakdown[0].match_count',
    'data.affiliated_breakdown[0].top_confidence'
  ];

  let structureValid = true;
  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], directData);
    if (value === undefined || value === null) {
      console.log(`   ❌ Missing field: ${field}`);
      structureValid = false;
    } else {
      console.log(`   ✅ Field exists: ${field} = ${JSON.stringify(value)}`);
    }
  });

  console.log(`   Response Structure: ${structureValid ? '✅ VALID' : '❌ INVALID'}`);

  // Test 3: Simulate frontend filtering logic
  console.log('\n3️⃣ Testing frontend filtering logic...');

  const affiliatedBreakdown = directData.data?.affiliated_breakdown || [];
  const totalAffiliatedMatches = directData.data?.match_summary?.total_affiliated_matches || 0;

  // This is the exact logic from frontend lines 328-332
  const shouldShow = affiliatedBreakdown.length > 0 && totalAffiliatedMatches > 0;

  console.log(`   - affiliated_breakdown length: ${affiliatedBreakdown.length}`);
  console.log(`   - total_affiliated_matches: ${totalAffiliatedMatches}`);
  console.log(`   - Frontend should show: ${shouldShow ? '✅ YES' : '❌ NO'}`);

  // Test 4: Verify display logic
  console.log('\n4️⃣ Testing display logic...');

  const matchingCompanies = affiliatedBreakdown.filter(item => item.has_matches);

  if (matchingCompanies.length > 0) {
    console.log('   ✅ Companies to display:');
    matchingCompanies.forEach(company => {
      console.log(`      - ${company.company_name} matches exactly with an entity in Canadian Named Research Organizations`);
    });
  } else {
    console.log('   ❌ No companies to display');
  }

  // Final Assessment
  console.log('\n🏁 FINAL ASSESSMENT');
  console.log('==================');

  const allTestsPass = nuditMatches.length > 0 && structureValid && shouldShow && matchingCompanies.length > 0;

  if (allTestsPass) {
    console.log('🎉 ALL TESTS PASS - System should be working correctly!');
    console.log('✅ NUDT matching: WORKING');
    console.log('✅ API response: CORRECT');
    console.log('✅ Frontend filtering: SHOULD SHOW RESULTS');
    console.log('✅ Display logic: CORRECT COMPANIES IDENTIFIED');
  } else {
    console.log('❌ Some tests failed - check the issues above');
  }

  return allTestsPass;
};

testFinalVerification();