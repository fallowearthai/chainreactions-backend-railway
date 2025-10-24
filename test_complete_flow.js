// Test script that simulates a complete Entity Relations search with NUDT and CAEP
const testCompleteFlow = async () => {
  try {
    console.log('🧪 Testing complete Entity Relations flow...');

    // Simulate the exact entities that should come from SearchResults parsing
    const simulatedEntities = [
      "Shandong Provincial Military Region",
      "Weifang Military Sub-region",
      "Chinese Academy of Engineering Physics (CAEP)",
      "State Administration for Science",
      "National University of Defense Technology (NUDT)"
    ];

    console.log('📝 Simulated entities from SearchResults parsing:');
    simulatedEntities.forEach((entity, index) => {
      console.log(`  ${index + 1}. ${entity}`);
    });

    // Test each entity individually like DatasetMatchingDropdown does
    const results = [];

    for (let i = 0; i < simulatedEntities.length; i++) {
      const entity = simulatedEntities[i];
      console.log(`\n🔍 Testing entity ${i + 1}: ${entity}`);

      const requestPayload = {
        entity: `Intermediary B - ${i + 1}`, // This is what frontend sends
        location: undefined,
        affiliated_companies: [
          {
            company_name: entity,
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

      const response = await fetch('http://localhost:3004/api/dataset-matching/affiliated-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();

      if (data.success && data.data) {
        const affiliatedBreakdown = data.data.affiliated_breakdown || [];
        const hasMatches = affiliatedBreakdown.some(item => item.has_matches);

        results.push({
          entity: entity,
          entityIndex: i + 1,
          hasMatches: hasMatches,
          breakdown: affiliatedBreakdown
        });

        console.log(`  Result: ${hasMatches ? '✅ MATCH' : '❌ NO MATCH'}`);

        if (hasMatches) {
          affiliatedBreakdown.forEach(item => {
            if (item.has_matches) {
              console.log(`    - ${item.company_name}: ${item.match_count} matches, confidence: ${item.top_confidence}`);
            }
          });
        }
      } else {
        console.log(`  ❌ API call failed:`, data);
        results.push({
          entity: entity,
          entityIndex: i + 1,
          hasMatches: false,
          breakdown: [],
          error: 'API call failed'
        });
      }
    }

    // Summary
    console.log('\n📊 COMPLETE FLOW SUMMARY:');
    console.log('========================');

    const matchingEntities = results.filter(r => r.hasMatches);
    const nonMatchingEntities = results.filter(r => !r.hasMatches);

    console.log(`\n✅ Entities with matches (${matchingEntities.length}):`);
    matchingEntities.forEach(result => {
      console.log(`  - Intermediary B - ${result.entityIndex}: ${result.entity}`);
    });

    console.log(`\n❌ Entities without matches (${nonMatchingEntities.length}):`);
    nonMatchingEntities.forEach(result => {
      console.log(`  - Intermediary B - ${result.entityIndex}: ${result.entity}`);
    });

    // Check specifically for NUDT and CAEP
    const nudtResult = results.find(r => r.entity.includes('NUDT'));
    const caepResult = results.find(r => r.entity.includes('CAEP'));

    console.log('\n🎯 TARGET ENTITY RESULTS:');
    console.log(`NUDT: ${nudtResult ? (nudtResult.hasMatches ? '✅ MATCHED' : '❌ NOT MATCHED') : '❌ NOT FOUND'}`);
    console.log(`CAEP: ${caepResult ? (caepResult.hasMatches ? '✅ MATCHED' : '❌ NOT MATCHED') : '❌ NOT FOUND'}`);

    console.log('\n🎨 FRONTEND DISPLAY PREDICTION:');
    console.log('The frontend should display the following companies:');
    matchingEntities.forEach(result => {
      console.log(`✅ ${result.entity} matches exactly with an entity in Canadian Named Research Organizations`);
    });

    console.log('\n🔧 EXPECTED VS ACTUAL:');
    console.log(`Expected: NUDT and CAEP should match`);
    console.log(`Actual: ${matchingEntities.map(r => r.entity).join(', ') || 'No matches'}`);

    // Final assessment
    const expectedMatches = ['National University of Defense Technology (NUDT)', 'Chinese Academy of Engineering Physics (CAEP)'];
    const actualMatches = matchingEntities.map(r => r.entity);

    const allExpectedMatched = expectedMatches.every(expected => actualMatches.some(actual => actual.includes(expected)));

    console.log(`\n🏁 TEST RESULT: ${allExpectedMatched ? '✅ SUCCESS' : '❌ FAILURE'}`);

    if (!allExpectedMatched) {
      console.log('❌ ISSUE: Some expected entities are not matching');
      const missing = expectedMatches.filter(expected => !actualMatches.some(actual => actual.includes(expected)));
      console.log(`Missing matches: ${missing.join(', ')}`);
    } else {
      console.log('✅ All expected entities (NUDT, CAEP) are correctly matching');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testCompleteFlow();