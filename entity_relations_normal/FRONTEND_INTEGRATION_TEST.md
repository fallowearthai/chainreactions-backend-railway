# Frontend Integration Testing Guide

## ✅ Completed Setup

### Backend Service
- **Port**: 3005
- **Status**: Running and tested
- **Endpoint**: `http://localhost:3005/api/normal-search`
- **Timeout**: 180 seconds (3 minutes)
- **Thinking Budget**: 6000 tokens (optimized for speed)

### Frontend Configuration
- **Endpoint Updated**: ✅ Changed from N8N to local backend
- **File**: `/Users/kanbei/Code/chainreactions_frontend_dev/src/components/dashboard/hooks/useCompanyRelationsSearch.ts:95`
- **Old**: `https://n8n.fallowearth.site/webhook/normal-search`
- **New**: `http://localhost:3005/api/normal-search`

### Response Format Compatibility
- ✅ Backend returns `raw_data` format
- ✅ Frontend parser (`useSearchResultsParser`) handles `raw_data`
- ✅ Frontend displays: Risk Item, Institution A, Relationship Type, Finding Summary, Intermediary B, Sources

## 🧪 Testing Steps

### 1. Test Normal Search Functionality

**Test Case 1: Simple Query**
```
Target Institution: MIT
Risk Entity: Harvard
Location: United States
Expected Time: ~10-15 seconds
Expected Result: Direct relationship found
```

**Test Case 2: Complex Query**
```
Target Institution: University of Waterloo
Risk Entity: University of Toronto
Location: Canada
Expected Time: ~30-60 seconds
Expected Result: Relationship analysis with sources
```

### 2. Verify Search History Storage

**Steps**:
1. Complete a search
2. Check browser console for: `"Search history saved successfully"`
3. Check Network tab for POST to `/search_history` table
4. Verify response contains `id` field

**Expected Console Logs**:
```
Search response: { result: "...", urls: "...", raw_data: {...} }
Credits deducted successfully for ordinary search
Search completed successfully
Search history saved successfully
```

### 3. Verify Search History Display

**Current Issue**: Search history may not display immediately after save

**Debug Steps**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Execute search
4. Look for these logs:
   - `saveSearchHistory` call
   - Cache清除: `searchHistoryCache.delete(user.id)`
   - `loadPage(0)` call
5. Check Network tab for:
   - POST to `search_history` (save)
   - GET from `search_history` (refresh)

**Expected Behavior**:
- `saveSearchHistory` in `useOptimizedSearchHistory.ts:178-225` should:
  1. Save to Supabase ✅
  2. Clear cache ✅
  3. Call `loadPage(0)` to refresh ✅

### 4. Manual Refresh Test

If history doesn't auto-refresh:
1. Manually refresh the page (F5)
2. Check if search history appears in sidebar
3. If yes → auto-refresh issue
4. If no → storage issue

## 🔍 Debugging Commands

### Check Backend Logs
```bash
# Should show:
# ✅ Successfully parsed 1 search results
# ✅ Normal Search completed successfully
```

### Check Supabase Directly
```sql
-- In Supabase SQL Editor
SELECT id, search_type, target_institution, risk_entity, created_at
FROM search_history
WHERE search_type = 'company-relations'
ORDER BY created_at DESC
LIMIT 5;
```

### Test Backend Response Format
```bash
curl -X POST "http://localhost:3005/api/normal-search" \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "MIT",
    "Risk_Entity": "Harvard",
    "Location": "United States"
  }' | jq '.raw_data'
```

Expected output should include:
- `risk_item`
- `institution_A`
- `relationship_type`
- `finding_summary`
- `potential_intermediary_B`
- `urls`
- `sources_count`

## 📊 Current Status

### ✅ Working
1. Backend service (port 3005)
2. Gemini API integration with Google Search
3. JSON parsing and response formatting
4. Frontend endpoint migration
5. Result display in frontend
6. Search history storage in Supabase

### ❓ To Verify
1. Search history auto-refresh in sidebar
   - Code logic exists: `saveSearchHistory` → `loadPage(0)`
   - Need to verify execution in browser

### 🔧 Known Issues & Solutions

**Issue 1: Timeout on Complex Queries**
- **Symptoms**: Search hangs for 2 minutes, then fails
- **Solution**: ✅ Fixed - Increased timeout to 180s, reduced thinking budget to 6000
- **Status**: Resolved

**Issue 2: Search History Not Displaying**
- **Symptoms**: Search completes, but history sidebar doesn't update
- **Current Status**: Investigating
- **Theory**: `loadPage(0)` may not trigger UI refresh
- **Next Step**: Check browser console during search

## 🎯 Success Criteria

- [x] Backend responds within 3 minutes
- [x] Response format matches frontend expectations
- [x] Results display correctly in UI
- [x] Search history saves to Supabase
- [ ] Search history appears in sidebar automatically
- [ ] Clicking history item loads results correctly

## 📝 Notes

- Frontend uses `useOptimizedSearchHistory` hook with caching
- Cache duration: 3 minutes
- Page size: 15 items
- Search history includes `search_results` field for display

## Next Actions

1. **Immediate**: Test in browser with DevTools open
2. **Monitor**: Console logs during search + save
3. **Verify**: Network calls to search_history table
4. **Compare**: With Dataset Search implementation (which works correctly)
