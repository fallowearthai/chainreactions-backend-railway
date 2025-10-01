# Dataset Search SSE Integration Guide

**Date**: 2025-10-01
**Status**: ✅ Integration Complete - Ready for Testing

## 🎯 Overview

Successfully integrated SSE (Server-Sent Events) streaming between backend Dataset Search Service and frontend, replacing the N8N workflow for Canadian NRO searches.

---

## 🏗️ Architecture

### Backend (Port 3004)
**Service**: Dataset Search Service
**Endpoint**: `POST http://localhost:3004/api/dataset-search/stream`
**Technology**: Server-Sent Events (SSE)

**Key Components**:
- `LinkupSearchService.ts` - Dual API parallel processing
- `SSEService.ts` - Real-time event streaming
- `SupabaseNROService.ts` - Canadian NRO data (103 entities)
- `LinkupResponseParser.ts` - JSON response parsing

### Frontend (Port 8080)
**Location**: `/Users/kanbei/Code/chainreactions_frontend_dev`

**New Files Created**:
- `src/components/dashboard/hooks/useDatasetSearchSSE.ts` - SSE client hook

**Modified Files**:
- `src/components/dashboard/hooks/useLongTextSearch.ts` - Integrated SSE hook

---

## 🔄 Integration Flow

```
User Input (Target Institution)
         ↓
LongTextSearchForm Component
         ↓
useLongTextSearch Hook
         ↓
useDatasetSearchSSE Hook
         ↓
SSE POST /api/dataset-search/stream
         ↓
Backend SSE Service
         ↓
Real-time Events Stream
         ↓
Frontend UI Updates
```

---

## 📡 SSE Event Types

### 1. Connection Event
```json
{
  "stage": "connection",
  "status": "established",
  "data": {
    "executionId": "abc-123-def"
  }
}
```

### 2. Progress Event
```json
{
  "stage": "progress",
  "current": 5,
  "total": 103,
  "message": "Processing entity 5 of 103"
}
```

### 3. New Result Event
```json
{
  "stage": "new_result",
  "current": 5,
  "total": 103,
  "data": {
    "risk_item": "University of Waterloo",
    "relationship_type": "Indirect",
    "finding_summary": "...",
    "intermediary_organizations": ["..."],
    "source_urls": ["https://..."],
    "raw_response": {...}
  }
}
```

### 4. Completed Event
```json
{
  "stage": "completed",
  "message": "Search completed: 103 entities processed"
}
```

### 5. Error Event
```json
{
  "stage": "error",
  "message": "Error description"
}
```

---

## 🚀 Usage

### Backend
```bash
cd /Users/kanbei/Code/chainreactions_backend/dataset_search
npm run dev
# Service runs on port 3004
```

### Frontend
```bash
cd /Users/kanbei/Code/chainreactions_frontend_dev
npm run dev
# Frontend runs on port 8080
```

### Test Search
1. Open browser: `http://localhost:8080`
2. Navigate to "Dataset Search"
3. Enter target institution (e.g., "Peking University")
4. Keep "Search relationships with Canadian Named Research Organizations" checked
5. Click "Search"
6. Observe real-time results streaming

---

## 🔑 Key Features

### ✅ Implemented
- [x] SSE streaming from backend to frontend
- [x] Real-time progress updates
- [x] Dual API parallel processing (2 Linkup API keys)
- [x] Graceful error handling
- [x] Search cancellation support
- [x] Backward compatibility with N8N (Excel uploads)
- [x] 103 Canadian NRO entities integration
- [x] JSON response parsing from Linkup API

### 📊 Performance
- **Single API**: ~15 minutes for 103 entities
- **Dual API**: ~7.5-8 minutes (predicted 50% improvement)
- **Rate Limit**: 10 qps per account (not per API key)
- **Bottleneck**: API response time (~8.7s per query)

---

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
PORT=3004
LINKUP_API_KEY=your-primary-key
LINKUP_API_KEY_2=your-secondary-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-key
```

#### Frontend
```typescript
// Default in useDatasetSearchSSE.ts
const backendUrl = import.meta.env.VITE_DATASET_SEARCH_URL || 'http://localhost:3004';
```

**Optional**: Create `.env` in frontend to override
```bash
VITE_DATASET_SEARCH_URL=http://localhost:3004
```

---

## 🧪 Testing Checklist

### Unit Testing
- [ ] Backend SSE endpoint health check
- [ ] Frontend SSE hook connection
- [ ] Event parsing logic
- [ ] Error handling

### Integration Testing
- [ ] End-to-end search with test data
- [ ] Cancel functionality
- [ ] Multiple concurrent users
- [ ] Network interruption recovery

### Test Scenarios

#### Scenario 1: Basic Search
```
Input: "Peking University"
Expected: 103 results streaming in real-time
Duration: ~7.5-8 minutes
```

#### Scenario 2: Search Cancellation
```
Action: Start search, then cancel mid-way
Expected: Clean SSE disconnection, partial results saved
```

#### Scenario 3: Error Handling
```
Action: Backend offline, start search
Expected: Error message displayed, graceful failure
```

---

## 🔀 Backward Compatibility

### N8N Excel Upload (Legacy)
Still functional for Excel file uploads:
- User uploads Excel file → Uses N8N workflow
- Uses Supabase Realtime for progress updates
- Maintains existing functionality

### SSE Dataset Search (New)
For Canadian NRO dataset searches:
- No Excel file → Uses SSE streaming
- Direct backend connection
- No Supabase Realtime needed

---

## 🐛 Troubleshooting

### Issue: SSE Connection Fails
**Solution**:
1. Check backend is running on port 3004
2. Check CORS configuration allows `http://localhost:8080`
3. Verify network connectivity

### Issue: No Results Streaming
**Solution**:
1. Check browser console for errors
2. Verify backend logs for processing
3. Test with `test-frontend.html` first

### Issue: Slow Performance
**Solution**:
1. Verify dual API keys are from different accounts
2. Check Linkup API rate limits
3. Monitor backend logs for API response times

---

## 📚 Related Documentation

- **Backend README**: `/Users/kanbei/Code/chainreactions_backend/dataset_search/README.md`
- **CLAUDE.md**: Project development guidelines
- **PROGRESS_TRACKING.md**: Overall project progress

---

## 🎉 Next Steps

1. **Test Integration**: Run end-to-end tests with real searches
2. **Performance Monitoring**: Track actual dual-API performance improvement
3. **User Feedback**: Gather feedback on real-time UX
4. **Production Deployment**: Prepare for production environment
5. **Analytics Integration**: Add search analytics and logging

---

**Integration Status**: ✅ Complete
**Testing Status**: 🧪 Ready for Testing
**Production Ready**: ⏳ Pending Testing
