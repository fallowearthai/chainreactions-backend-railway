"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const DatasetSearchController_1 = require("./controllers/DatasetSearchController");
const ErrorHandler_1 = require("./utils/ErrorHandler");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3004;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://your-frontend-domain.com'] // Replace with actual frontend domain
        : ['http://localhost:8080', 'http://localhost:8081', 'null'], // Allow both frontend and test ports + local files
    credentials: true
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
// Initialize controllers
const datasetSearchController = new DatasetSearchController_1.DatasetSearchController();
// Routes
app.get('/api', (req, res) => {
    res.json({
        service: 'Dataset Search Service',
        version: '2.0.0',
        description: 'ChainReactions Dataset Search Service with SSE Streaming Support',
        endpoints: [
            'POST /api/dataset-search/stream - Start SSE streaming search',
            'DELETE /api/dataset-search/stream/:execution_id - Cancel streaming search',
            'GET /api/dataset-search/stream/:execution_id/status - Get streaming search status',
            'GET /api/dataset-search/nro-stats - Get Canadian NRO statistics',
            'GET /api/health - Health check'
        ],
        status: 'running',
        features: {
            sse_streaming: 'enabled',
            concurrent_search: 'enabled',
            canadian_nro_data: 'enabled'
        }
    });
});
// Health check
app.get('/api/health', datasetSearchController.healthCheck);
// Simple test endpoint
app.get('/api/test', (req, res) => {
    console.log('🧪 Test endpoint hit!');
    res.json({ message: 'Test endpoint working!', timestamp: new Date().toISOString() });
});
// SSE Streaming Routes
app.post('/api/dataset-search/stream', datasetSearchController.streamSearch);
app.delete('/api/dataset-search/stream/:execution_id', datasetSearchController.cancelStreamSearch);
app.get('/api/dataset-search/stream/:execution_id/status', datasetSearchController.getStreamSearchStatus);
app.get('/api/dataset-search/nro-stats', datasetSearchController.getNROStats);
// Serve the test frontend explicitly
app.get('/test-frontend.html', (req, res) => {
    console.log('📄 Serving test-frontend.html');
    res.sendFile('test-frontend.html', { root: '.' });
});
// Serve static files (test frontend) - must be after API routes
app.use(express_1.default.static('.'));
// Error handling middleware
app.use(ErrorHandler_1.errorHandler);
// 404 handler
app.use(ErrorHandler_1.notFoundHandler);
// Environment variable validation
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'LINKUP_API_KEY'];
const missingRequiredVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingRequiredVars.length > 0) {
    console.error(`❌ Error: Missing required environment variables: ${missingRequiredVars.join(', ')}`);
    console.error('   SSE streaming functionality will not work without proper configuration.');
    process.exit(1);
}
app.listen(PORT, () => {
    console.log(`🚀 Dataset Search Service v2.0.0 running on port ${PORT}`);
    console.log(`📋 Service endpoints:`);
    console.log(`   • GET  /api - Service information`);
    console.log(`   • GET  /api/health - Health check`);
    console.log(``);
    console.log(`   📡 SSE Streaming:`);
    console.log(`   • POST /api/dataset-search/stream - Start streaming search`);
    console.log(`   • DELETE /api/dataset-search/stream/:id - Cancel streaming search`);
    console.log(`   • GET  /api/dataset-search/stream/:id/status - Stream status`);
    console.log(`   • GET  /api/dataset-search/nro-stats - Canadian NRO statistics`);
    console.log(``);
    console.log(`🔧 Configuration:`);
    console.log(`   🗄️  Supabase: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
    console.log(`   🔍 Linkup API: ${process.env.LINKUP_API_KEY ? '✅' : '❌'}`);
    console.log(``);
    console.log(`🎯 Ready for SSE streaming dataset searches with Canadian NRO data!`);
});
exports.default = app;
//# sourceMappingURL=app.js.map