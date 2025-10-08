#!/usr/bin/env node

/**
 * Test script to verify location handling consistency
 * between initial search and refresh functionality
 */

const http = require('http');
const { URL } = require('url');

// Test data for empty location field
const testData = {
  "Target_institution": "Test University",
  "Risk_Entity": "Test Entity",
  "Location": "",  // Empty location field
  "Start_Date": "",
  "End_Date": ""
};

console.log('🧪 Testing Location Handling Consistency');
console.log('==========================================');
console.log('Test Data:', JSON.stringify(testData, null, 2));
console.log('');

// Function to make POST request
function makeRequest(data, description) {
  return new Promise((resolve, reject) => {
    console.log(`📡 ${description}`);
    console.log('   Request data:', JSON.stringify(data, null, 2));

    const postData = JSON.stringify(data);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/enhanced/strategy',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          console.log('   ✅ Response received');
          console.log('   📊 Location used in search:', parsedData.search_strategy?.country_code || 'N/A');
          console.log('   🌍 Search engines:', parsedData.search_strategy?.source_engine || 'N/A');
          console.log('   🎯 Generated keywords:', parsedData.search_strategy?.search_keywords?.length || 0);
          resolve(parsedData);
        } catch (error) {
          console.error('   ❌ Error parsing response:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('   ❌ Request error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Function to simulate refresh (same data)
function simulateRefresh(originalData, description) {
  console.log(`\n🔄 ${description}`);
  console.log('   Refreshing with same data...');
  return makeRequest(originalData, 'Refresh Request');
}

// Run the test
async function runTest() {
  try {
    console.log('Step 1: Initial Search');
    console.log('-------------------');
    const initialResult = await makeRequest(testData, 'Initial Search Request');

    console.log('\nStep 2: Refresh Search');
    console.log('--------------------');
    const refreshResult = await simulateRefresh(testData, 'Refresh Request');

    console.log('\n🔍 Comparison Results');
    console.log('======================');

    const initialLocation = initialResult.search_strategy?.country_code;
    const refreshLocation = refreshResult.search_strategy?.country_code;
    const initialEngines = initialResult.search_strategy?.source_engine;
    const refreshEngines = refreshResult.search_strategy?.source_engine;

    console.log('Initial search location:', initialLocation);
    console.log('Refresh search location:', refreshLocation);
    console.log('Location consistency:', initialLocation === refreshLocation ? '✅ CONSISTENT' : '❌ INCONSISTENT');

    console.log('\nInitial search engines:', initialEngines);
    console.log('Refresh search engines:', refreshEngines);
    console.log('Engine consistency:', JSON.stringify(initialEngines) === JSON.stringify(refreshEngines) ? '✅ CONSISTENT' : '❌ INCONSISTENT');

    if (initialLocation === refreshLocation && JSON.stringify(initialEngines) === JSON.stringify(refreshEngines)) {
      console.log('\n🎉 SUCCESS: Location handling is consistent between initial search and refresh!');
    } else {
      console.log('\n⚠️  WARNING: Inconsistencies detected in location handling');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running
function checkServer() {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:3000/api/health', (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Server returned status code: ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.end();
  });
}

// Main execution
async function main() {
  try {
    await checkServer();
    console.log('✅ Server is running');
    await runTest();
  } catch (error) {
    console.error('❌ Server check failed:', error.message);
    console.log('   Please ensure the backend server is running on http://localhost:3000');
    process.exit(1);
  }
}

main();