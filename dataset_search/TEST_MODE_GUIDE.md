# Dataset Search Test Mode Guide

**Date**: 2025-10-01
**Feature**: Test Mode Toggle for Token Conservation

---

## 🎯 Overview

Added a **Test Mode** toggle to the Dataset Search interface that limits searches to only 6 entities instead of all 103, preventing unnecessary API token consumption during development and testing.

---

## ✨ Features

### 1. Test Mode Toggle (NEW)
- **Location**: Dataset Search Form
- **Default State**: ✅ Enabled (Safe by default)
- **Visual Indicator**: Yellow badge "Recommended for testing"
- **Info Button**: Explains test mode functionality

### 2. Smart Warnings
- **Production Mode Warning**: Confirmation dialog when disabling test mode
- **Token Usage Alert**: Informs user about high token consumption
- **Time Estimate**: Shows ~7-8 minutes for full search

### 3. Dynamic Total Items
- **Test Mode**: 6 entities
- **Production Mode**: 103 entities
- **Progress Bar**: Automatically adjusts based on mode

---

## 🎨 UI Components

### Test Mode Switch

```
┌─────────────────────────────────────────────────────┐
│ ☑ Search relationships with Canadian NRO     [i]   │
│                                                     │
│   ├─ ☑ Test Mode (6 entities only)           [i]  │
│        [Recommended for testing]                   │
└─────────────────────────────────────────────────────┘
```

### Info Messages

**Test Mode Info**:
> Test Mode limits the search to only 6 entities from the NRO list to save API tokens during development and testing. Uncheck this to search all 103 entities (production mode).

**Production Warning**:
```
⚠️ Warning: You are about to search all 103 entities
which will consume significant API tokens.

Estimated time: ~7-8 minutes
Token usage: High

Continue with production search?
[Cancel] [OK]
```

---

## 🔧 Technical Implementation

### Frontend Changes

**File**: `LongTextSearchForm.tsx`
- Added `useTestMode` state (default: `true`)
- Added `testMode` to `LongTextSearchFormData` interface
- Added test mode toggle UI with info button
- Added production mode confirmation dialog

**File**: `useLongTextSearch.ts`
- Passes `testMode` parameter to SSE hook
- Sets `totalItems` to 6 for test mode, 103 for production
- Shows appropriate toast messages

**File**: `useDatasetSearchSSE.ts`
- Accepts `testMode` parameter in `startSSESearch()`
- Passes to backend via POST request body

### Backend Handling

**File**: `DatasetSearchController.ts`
- Receives `test_mode` from request body
- Passes to `SupabaseNROService.getAllNROOrganizations(testMode)`
- Limits to 6 entities when `testMode === true`

---

## 📊 Usage Comparison

| Mode | Entities | Time | Token Usage | Use Case |
|------|----------|------|-------------|----------|
| **Test Mode** | 6 | ~45s | Low | Development, testing, debugging |
| **Production** | 103 | ~7-8min | High | Real searches, production data |

---

## 🧪 Testing Instructions

### Test Mode (Default)

1. Open `http://localhost:8080`
2. Navigate to "Dataset Search"
3. Enter institution: "Peking University"
4. **Verify**: "Test Mode (6 entities only)" is checked ✅
5. **Verify**: Yellow badge shows "Recommended for testing"
6. Click Search button
7. **Expect**: Toast "Test mode search started (6 entities)"
8. **Expect**: Progress shows "X / 6 entities"
9. **Expect**: Search completes in ~45 seconds
10. **Expect**: 6 results displayed

### Production Mode

1. **Uncheck** "Test Mode (6 entities only)"
2. Click Search button
3. **Expect**: Warning dialog appears
4. Read warning carefully
5. Click "OK" to confirm
6. **Expect**: Toast "Production search started (103 entities)"
7. **Expect**: Progress shows "X / 103 entities"
8. **Expect**: Search takes ~7-8 minutes
9. **Expect**: Up to 103 results displayed

### Info Buttons

1. Click info button next to "Canadian NRO"
   - **Expect**: Dataset information tooltip
2. Click info button next to "Test Mode"
   - **Expect**: Test mode explanation tooltip

---

## 🔒 Safety Features

### 1. Default to Test Mode
```typescript
const [useTestMode, setUseTestMode] = useState(true);
// ✅ Safe by default
```

### 2. Confirmation Dialog
```typescript
if (useDatasetSearch && !useTestMode) {
  const confirmed = window.confirm(...);
  if (!confirmed) return; // ✅ User can cancel
}
```

### 3. Visual Indicators
- Yellow badge for test mode
- Info buttons for guidance
- Progress bar shows correct totals

---

## 📈 Token Conservation

### Estimated Token Usage

**Test Mode (6 entities)**:
- Total queries: 6
- Estimated tokens: ~6,000-30,000
- Cost: ~$0.06-0.30
- Time: ~45 seconds

**Production Mode (103 entities)**:
- Total queries: 103
- Estimated tokens: ~103,000-515,000
- Cost: ~$1.03-5.15
- Time: ~7-8 minutes

### Savings
- **94.2% fewer entities** in test mode
- **94.2% token savings** during development
- **90% time savings** for quick tests

---

## 🎯 Recommended Workflow

### Development Phase
1. ✅ Use Test Mode for all testing
2. ✅ Verify UI/UX with 6 entities
3. ✅ Test error handling
4. ✅ Validate SSE streaming

### Pre-Production Testing
1. ⚠️ Disable Test Mode
2. ⚠️ Run 1-2 full searches
3. ⚠️ Verify all 103 entities work
4. ⚠️ Check performance metrics

### Production
1. ❌ Test Mode disabled by users
2. ✅ Full 103-entity searches
3. ✅ Real production data
4. ✅ Complete results

---

## 🐛 Troubleshooting

### Issue: Test Mode not working
**Check**:
1. Backend receives `test_mode: true` in request
2. Backend logs show "Test Mode: true"
3. SupabaseNROService limits results to 6
4. Frontend shows "6 entities" in toast

### Issue: Can't disable Test Mode
**Solution**:
- Test mode switch should be clickable
- Confirmation dialog should appear
- Check browser console for errors

### Issue: Wrong entity count
**Check**:
1. Frontend: `data.testMode` value
2. Backend: `req.body.test_mode` value
3. Supabase query: `.limit(6)` applied

---

## 📚 Related Files

**Frontend**:
- `src/components/dashboard/LongTextSearchForm.tsx`
- `src/components/dashboard/hooks/useLongTextSearch.ts`
- `src/components/dashboard/hooks/useDatasetSearchSSE.ts`

**Backend**:
- `src/controllers/DatasetSearchController.ts`
- `src/services/SupabaseNROService.ts`
- `src/services/LinkupSearchService.ts`

---

## ✅ Checklist

**Implementation**:
- [x] Test Mode toggle UI
- [x] Default to test mode
- [x] Confirmation dialog for production
- [x] Info buttons with explanations
- [x] Pass testMode to backend
- [x] Limit entities in test mode
- [x] Dynamic progress totals
- [x] Toast notifications

**Testing**:
- [ ] Test mode with 6 entities
- [ ] Production mode with 103 entities
- [ ] Confirmation dialog works
- [ ] Info buttons display correctly
- [ ] Progress bar shows correct totals
- [ ] Backend logs correct mode
- [ ] Token usage is appropriate

---

**Status**: ✅ Implemented
**Testing**: 🧪 Ready
**Documentation**: ✅ Complete
