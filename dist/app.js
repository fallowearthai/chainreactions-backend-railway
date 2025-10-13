"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const EnhancedSearchController_1 = require("./controllers/EnhancedSearchController");
const NormalSearchController_1 = require("./controllers/NormalSearchController");
const EntitySearchController_1 = require("./controllers/EntitySearchController");
const DatasetMatchingController_1 = require("./controllers/DatasetMatchingController");
const DataManagementController_1 = require("./controllers/DataManagementController");
const DatasetSearchController_1 = require("./controllers/DatasetSearchController");
const DemoRequestController_1 = require("./controllers/DemoRequestController");
const upload_1 = require("./services/data-management/middleware/upload");
const rateLimiter_1 = require("./middleware/rateLimiter");
const Logger_1 = require("./utils/Logger");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
// Middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request logging middleware - Production optimized
app.use((req, res, next) => {
    const startTime = Date.now();
    // Skip health check logging in production (too verbose)
    const isHealthCheck = req.path === '/api/health';
    const isStaticFile = req.path.startsWith('/public') || req.path.match(/\.(css|js|png|jpg|ico)$/);
    if (!isHealthCheck && !isStaticFile) {
        // Only log detailed request info in debug mode
        Logger_1.logger.debug(`${req.method} ${req.path}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    }
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        // Skip health check and static file logging
        if (isHealthCheck || isStaticFile) {
            return;
        }
        // Use smart API logging
        Logger_1.logger.api(req.method, req.path, res.statusCode, duration);
    });
    next();
});
// CORS middleware
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? [
            'https://chainreactions.site', // Production domain (Digital Ocean)
            'https://chainreactions-frontend-dev.vercel.app',
            'https://chainreactions-frontend-dev-fallowearths-projects-06c459ff.vercel.app',
            'https://chainreactions-fronte-git-584dee-fallowearths-projects-06c459ff.vercel.app'
        ]
        : [
            'http://localhost:8080', // Frontend dev server
            'http://localhost:3000' // Alternative dev port
        ],
    credentials: true
}));
// Serve static files from public directory
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Create controller instances
const enhancedSearchController = new EnhancedSearchController_1.EnhancedSearchController();
const normalSearchController = new NormalSearchController_1.NormalSearchController();
const entitySearchController = new EntitySearchController_1.EntitySearchController();
const datasetMatchingController = new DatasetMatchingController_1.DatasetMatchingController();
const dataManagementController = new DataManagementController_1.DataManagementController();
const datasetSearchController = new DatasetSearchController_1.DatasetSearchController();
const demoRequestController = new DemoRequestController_1.DemoRequestController();
// Routes - 3-Stage OSINT Workflow (DeepThinking Mode)
app.post('/api/enhanced/search', (req, res) => enhancedSearchController.enhancedSearch(req, res));
app.get('/api/enhanced/search-stream', (req, res) => enhancedSearchController.enhancedSearchStream(req, res));
app.post('/api/enhanced/strategy', (req, res) => enhancedSearchController.getSearchStrategy(req, res));
app.get('/api/enhanced/test', (req, res) => enhancedSearchController.testWorkflow(req, res));
app.get('/api/enhanced/info', (req, res) => enhancedSearchController.getWorkflowInfo(req, res));
// Routes - Normal Search (Google Web Search Mode)
app.post('/api/normal-search', (req, res) => normalSearchController.handleNormalSearch(req, res));
app.get('/api/normal-search/info', (req, res) => normalSearchController.getInfo(req, res));
// Routes - Entity Search (Integrated from port 3002)
app.post('/api/entity-search', (req, res, next) => entitySearchController.handleEntitySearch(req, res, next));
// ⚠️ CRITICAL: Disabled test endpoint to prevent automatic token consumption
// app.get('/api/entity-search/test', apiTestRateLimiter, (req, res, next) => entitySearchController.testLinkupConnection(req, res, next));
// Routes - Dataset Matching (Integrated from port 3003)
app.post('/api/dataset-matching/match', (req, res, next) => datasetMatchingController.handleSingleMatch(req, res, next));
app.post('/api/dataset-matching/batch', (req, res, next) => datasetMatchingController.handleBatchMatch(req, res, next));
app.get('/api/dataset-matching/cache/clear', (req, res, next) => datasetMatchingController.handleClearCache(req, res, next));
app.post('/api/dataset-matching/cache/warmup', (req, res, next) => datasetMatchingController.handleCacheWarmup(req, res, next));
app.get('/api/dataset-matching/stats', (req, res, next) => datasetMatchingController.handleGetStats(req, res, next));
app.get('/api/dataset-matching/health', (req, res, next) => datasetMatchingController.handleHealthCheck(req, res, next));
app.get('/api/dataset-matching/test', (req, res, next) => datasetMatchingController.handleTestMatch(req, res, next));
// Routes - Data Management (Integrated from port 3006)
app.get('/api/data-management/datasets', (req, res) => dataManagementController.getDatasets(req, res));
app.get('/api/data-management/datasets/:id', (req, res) => dataManagementController.getDatasetById(req, res));
app.post('/api/data-management/datasets', (req, res) => dataManagementController.createDataset(req, res));
app.put('/api/data-management/datasets/:id', (req, res) => dataManagementController.updateDataset(req, res));
app.delete('/api/data-management/datasets/:id', (req, res) => dataManagementController.deleteDataset(req, res));
app.get('/api/data-management/datasets/:id/entries', (req, res) => dataManagementController.getDatasetEntries(req, res));
app.get('/api/data-management/datasets/:id/stats', (req, res) => dataManagementController.getDatasetStats(req, res));
app.post('/api/data-management/datasets/:id/upload', upload_1.upload.single('file'), upload_1.handleUploadError, (req, res) => dataManagementController.uploadFile(req, res));
app.post('/api/data-management/import/nro-targets', (req, res) => dataManagementController.importNroTargets(req, res));
app.post('/api/data-management/datasets/:id/validate-file', upload_1.upload.single('file'), upload_1.handleUploadError, (req, res) => dataManagementController.validateFile(req, res));
app.get('/api/data-management/datasets/:id/export', (req, res) => dataManagementController.exportDataset(req, res));
app.get('/api/data-management/health', (req, res) => dataManagementController.healthCheck(req, res));
app.get('/api/data-management/test', (req, res) => dataManagementController.testDataManagement(req, res));
// Routes - Dataset Search (Integrated from port 3004)
app.post('/api/dataset-search/stream', (req, res, next) => datasetSearchController.streamSearch(req, res, next));
app.delete('/api/dataset-search/stream/:execution_id', (req, res, next) => datasetSearchController.cancelStreamSearch(req, res, next));
app.get('/api/dataset-search/stream/:execution_id/status', (req, res, next) => datasetSearchController.getStreamSearchStatus(req, res, next));
app.get('/api/dataset-search/nro-stats', (req, res, next) => datasetSearchController.getNROStats(req, res, next));
app.get('/api/dataset-search/health', (req, res, next) => datasetSearchController.healthCheck(req, res, next));
app.get('/api/dataset-search/test', (req, res) => datasetSearchController.testDatasetSearch(req, res));
// Routes - Demo Email Service (Integrated from port 3001)
app.post('/api/demo-request', (req, res) => demoRequestController.handleDemoRequest(req, res));
app.get('/api/test-email', rateLimiter_1.apiTestRateLimiter, (req, res) => demoRequestController.testEmailService(req, res));
// Health check endpoint - Combined service
// IMPORTANT: Does NOT call real external APIs to prevent credit consumption
app.get('/api/health', rateLimiter_1.healthCheckRateLimiter, async (req, res) => {
    try {
        Logger_1.logger.debug('Health check requested - Configuration check only');
        // Check all services health - Configuration checks only, NO external API calls
        const entitySearchHealth = await entitySearchController.healthCheck();
        const datasetMatchingHealth = await datasetMatchingController.healthCheck();
        // Check new services health
        let dataManagementHealth = { status: 'operational', configured: true };
        let datasetSearchHealth = { status: 'operational', configured: true };
        let emailServiceHealth = { status: 'operational', configured: true };
        try {
            // For new services, we need to call the health check methods differently
            // since they're wrapper controllers
            const mockReq = {};
            const mockRes = {
                status: () => mockRes,
                json: (data) => {
                    if (data.status === 'unhealthy' || data.status === 'error') {
                        if (data.service === 'data-management') {
                            dataManagementHealth = { status: 'unhealthy', error: data.error };
                        }
                        else if (data.service === 'dataset-search') {
                            datasetSearchHealth = { status: data.status || 'healthy', configured: true };
                        }
                    }
                    return mockRes;
                }
            };
            await dataManagementController.healthCheck(mockReq, mockRes);
            await datasetSearchController.healthCheck(mockReq, mockRes, {});
            // Email service - lightweight check only
            try {
                // DO NOT call testEmailService - it consumes resources
                // Just check if credentials are configured
                const emailConfigured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
                emailServiceHealth = {
                    status: emailConfigured ? 'configured' : 'misconfigured',
                    configured: emailConfigured
                };
            }
            catch (error) {
                Logger_1.logger.debug('Email service config check failed', error);
                emailServiceHealth = { status: 'misconfigured', error: 'Email service not configured', configured: false };
            }
        }
        catch (error) {
            Logger_1.logger.debug('Health check warning for new services', error);
        }
        // Overall service health
        const allHealthy = entitySearchHealth.status === 'operational' &&
            datasetMatchingHealth.status === 'operational' &&
            dataManagementHealth.status === 'operational' &&
            (datasetSearchHealth.status === 'operational' || datasetSearchHealth.status === 'healthy') &&
            (emailServiceHealth.status === 'operational' || emailServiceHealth.status === 'configured');
        res.json({
            status: allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            service: 'ChainReactions Unified API Gateway',
            version: '3.0.1',
            important_note: '⚠️ Health check does NOT call external APIs to prevent credit consumption. Use dedicated test endpoints if you need to verify actual API connectivity.',
            unified_services: {
                entity_relations: {
                    modes: {
                        deepthinking: '3-Stage OSINT Workflow (Gemini + Bright Data SERP)',
                        normal: 'Google Web Search based OSINT (Gemini googleSearch)'
                    },
                    endpoints: {
                        deepthinking: '/api/enhanced/search',
                        normal: '/api/normal-search'
                    },
                    status: 'operational'
                },
                entity_search: {
                    description: 'Linkup API integration for professional business intelligence',
                    endpoints: {
                        search: '/api/entity-search',
                        test: '/api/entity-search/test (⚠️ DISABLED to prevent token consumption)'
                    },
                    health: entitySearchHealth
                },
                dataset_matching: {
                    description: 'Advanced entity matching with multiple algorithms',
                    endpoints: {
                        match: '/api/dataset-matching/match',
                        batch: '/api/dataset-matching/batch',
                        health: '/api/dataset-matching/health'
                    },
                    health: datasetMatchingHealth
                },
                data_management: {
                    description: 'CSV upload and intelligent parsing service',
                    endpoints: {
                        datasets: '/api/data-management/datasets',
                        upload: '/api/data-management/datasets/:id/upload',
                        export: '/api/data-management/datasets/:id/export',
                        health: '/api/data-management/health'
                    },
                    health: dataManagementHealth
                },
                dataset_search: {
                    description: 'Dataset search with SSE streaming and dual Linkup API processing',
                    endpoints: {
                        stream: '/api/dataset-search/stream (⚠️ Consumes credits!)',
                        nro_stats: '/api/dataset-search/nro-stats',
                        health: '/api/dataset-search/health'
                    },
                    health: datasetSearchHealth
                },
                email_service: {
                    description: 'Demo request email service with Gmail SMTP integration',
                    endpoints: {
                        demo_request: '/api/demo-request - Send demo request email',
                        test_email: '/api/test-email - Test email service connection (⚠️ Sends real email!)'
                    },
                    health: emailServiceHealth
                }
            },
            environment: process.env.NODE_ENV || 'development',
            port: process.env.PORT || 3000
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            service: 'ChainReactions Unified API Gateway',
            error: error.message
        });
    }
});
// Root endpoint - serve the frontend interface
app.get('/api', (req, res) => {
    res.json({
        message: 'ChainReactions Unified API Gateway - All Services Integrated',
        version: '3.0.0',
        services: {
            entity_relations: {
                name: 'Entity Relations OSINT Service',
                modes: {
                    deepthinking: {
                        name: '3-Stage OSINT Workflow',
                        architecture: {
                            stage1: 'WebSearch Meta-Prompting',
                            stage2: 'Multi-Engine SERP Execution',
                            stage3: 'AI Analysis & Integration'
                        },
                        endpoints: {
                            search: 'POST /api/enhanced/search - Complete 3-stage workflow',
                            strategy: 'POST /api/enhanced/strategy - Stage 1 only (meta-prompting)',
                            test: 'GET /api/enhanced/test - Test with sample data',
                            info: 'GET /api/enhanced/info - Workflow information'
                        }
                    },
                    normal: {
                        name: 'Google Web Search OSINT',
                        description: 'Fast OSINT analysis using Gemini googleSearch tool',
                        endpoints: {
                            search: 'POST /api/normal-search - Execute normal search',
                            info: 'GET /api/normal-search/info - Service information'
                        }
                    }
                }
            },
            entity_search: {
                name: 'Entity Search Service',
                description: 'Linkup API integration for professional business intelligence',
                endpoints: {
                    search: 'POST /api/entity-search - Entity search with domain filtering',
                    test: 'GET /api/entity-search/test - ⚠️ DISABLED to prevent token consumption'
                }
            },
            dataset_matching: {
                name: 'Dataset Matching Service',
                description: 'Advanced entity matching with multiple algorithms',
                endpoints: {
                    match: 'POST /api/dataset-matching/match - Single entity matching',
                    batch: 'POST /api/dataset-matching/batch - Batch entity matching',
                    health: 'GET /api/dataset-matching/health - Matching service health',
                    stats: 'GET /api/dataset-matching/stats - Service statistics',
                    test: 'GET /api/dataset-matching/test - Test matching with sample entity',
                    cache_clear: 'GET /api/dataset-matching/cache/clear - Clear cache',
                    cache_warmup: 'POST /api/dataset-matching/cache/warmup - Warmup cache'
                }
            },
            data_management: {
                name: 'Data Management Service',
                description: 'CSV upload and intelligent parsing service',
                endpoints: {
                    datasets: 'GET /api/data-management/datasets - List all datasets',
                    create_dataset: 'POST /api/data-management/datasets - Create new dataset',
                    dataset_detail: 'GET /api/data-management/datasets/:id - Get dataset details',
                    update_dataset: 'PUT /api/data-management/datasets/:id - Update dataset',
                    delete_dataset: 'DELETE /api/data-management/datasets/:id - Delete dataset',
                    upload: 'POST /api/data-management/datasets/:id/upload - Upload CSV file',
                    entries: 'GET /api/data-management/datasets/:id/entries - Get dataset entries',
                    stats: 'GET /api/data-management/datasets/:id/stats - Dataset statistics',
                    validate: 'POST /api/data-management/datasets/:id/validate-file - Validate file format',
                    export: 'GET /api/data-management/datasets/:id/export - Export dataset',
                    import_nro: 'POST /api/data-management/import/nro-targets - Import NRO targets',
                    health: 'GET /api/data-management/health - Service health check',
                    test: 'GET /api/data-management/test - Service test endpoint'
                }
            },
            dataset_search: {
                name: 'Dataset Search Service',
                description: 'Dataset search with SSE streaming and dual Linkup API processing',
                endpoints: {
                    stream_search: 'POST /api/dataset-search/stream - Start streaming search',
                    cancel_search: 'DELETE /api/dataset-search/stream/:execution_id - Cancel search',
                    search_status: 'GET /api/dataset-search/stream/:execution_id/status - Get search status',
                    nro_stats: 'GET /api/dataset-search/nro-stats - Get NRO statistics',
                    health: 'GET /api/dataset-search/health - Service health check',
                    test: 'GET /api/dataset-search/test - Service test endpoint'
                }
            },
            email_service: {
                name: 'Demo Email Service',
                description: 'Demo request email service with Gmail SMTP integration',
                endpoints: {
                    demo_request: 'POST /api/demo-request - Send demo request email',
                    test_email: 'GET /api/test-email - Test email service connection'
                }
            }
        },
        common_endpoints: {
            health: 'GET /api/health - Unified health check for all services',
            info: 'GET /api - Service information (this endpoint)'
        },
        port_unification: {
            description: 'All services now unified on port 3000',
            previous_ports: {
                entity_relations: 3000,
                entity_search: 3002,
                dataset_matching: 3003,
                data_management: 3006,
                dataset_search: 3004,
                email_service: 3001
            },
            current_port: 3000
        },
        documentation: 'See CLAUDE.md for detailed usage instructions'
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});
// Start server
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        Logger_1.logger.info('🚀 ChainReactions Unified API Gateway - All Services Integrated');
        Logger_1.logger.info(`📡 Server running on port ${PORT} (0.0.0.0)`);
        Logger_1.logger.info(`🏥 Health: http://localhost:${PORT}/api/health`);
        Logger_1.logger.info(`📊 Log Level: ${Logger_1.logger.getCurrentLevelName()}`);
        // Detailed endpoint listing only in development/debug mode
        if (!Logger_1.logger.isProductionMode()) {
            console.log('');
            console.log('🔬 Entity Relations Service:');
            console.log('  🔬 DeepThinking Mode (3-Stage Workflow):');
            console.log(`    POST /api/enhanced/search - Complete 3-stage workflow`);
            console.log(`    POST /api/enhanced/strategy - Stage 1 only (meta-prompting)`);
            console.log(`    GET  /api/enhanced/test - Test with sample data`);
            console.log(`    GET  /api/enhanced/info - Workflow information`);
            console.log('  ⚡ Normal Mode (Google Web Search):');
            console.log(`    POST /api/normal-search - Execute normal search`);
            console.log(`    GET  /api/normal-search/info - Service information`);
            console.log('');
            console.log('🔍 Entity Search Service (Integrated from port 3002):');
            console.log(`    POST /api/entity-search - Entity search with domain filtering`);
            // console.log(`    GET  /api/entity-search/test - Test Linkup API connection (DISABLED)`);
            console.log('');
            console.log('🎯 Dataset Matching Service (Integrated from port 3003):');
            console.log(`    POST /api/dataset-matching/match - Single entity matching`);
            console.log(`    POST /api/dataset-matching/batch - Batch entity matching`);
            console.log(`    GET  /api/dataset-matching/health - Matching service health`);
            console.log(`    GET  /api/dataset-matching/stats - Service statistics`);
            console.log(`    GET  /api/dataset-matching/test - Test matching with sample entity`);
            console.log(`    GET  /api/dataset-matching/cache/clear - Clear cache`);
            console.log(`    POST /api/dataset-matching/cache/warmup - Warmup cache`);
            console.log('');
            console.log('📊 Data Management Service (Integrated from port 3006):');
            console.log(`    GET  /api/data-management/datasets - List all datasets`);
            console.log(`    POST /api/data-management/datasets - Create new dataset`);
            console.log(`    GET  /api/data-management/datasets/:id - Get dataset details`);
            console.log(`    PUT  /api/data-management/datasets/:id - Update dataset`);
            console.log(`    DELETE /api/data-management/datasets/:id - Delete dataset`);
            console.log(`    POST /api/data-management/datasets/:id/upload - Upload CSV file`);
            console.log(`    GET  /api/data-management/datasets/:id/entries - Get dataset entries`);
            console.log(`    GET  /api/data-management/datasets/:id/stats - Dataset statistics`);
            console.log(`    POST /api/data-management/datasets/:id/validate-file - Validate file format`);
            console.log(`    GET  /api/data-management/datasets/:id/export - Export dataset`);
            console.log(`    POST /api/data-management/import/nro-targets - Import NRO targets`);
            console.log(`    GET  /api/data-management/health - Service health check`);
            console.log(`    GET  /api/data-management/test - Service test endpoint`);
            console.log('');
            console.log('🔍 Dataset Search Service (Integrated from port 3004):');
            console.log(`    POST /api/dataset-search/stream - Start streaming search`);
            console.log(`    DELETE /api/dataset-search/stream/:execution_id - Cancel search`);
            console.log(`    GET  /api/dataset-search/stream/:execution_id/status - Get search status`);
            console.log(`    GET  /api/dataset-search/nro-stats - Get NRO statistics`);
            console.log(`    GET  /api/dataset-search/health - Service health check`);
            console.log(`    GET  /api/dataset-search/test - Service test endpoint`);
            console.log('');
            console.log('📧 Demo Email Service (Integrated from port 3001):');
            console.log(`    POST /api/demo-request - Send demo request email`);
            console.log(`    GET  /api/test-email - Test email service connection`);
            console.log('');
        }
        // Check if environment variables are set
        Logger_1.logger.debug('🔧 Environment Configuration:');
        if (!process.env.GEMINI_API_KEY) {
            Logger_1.logger.warn('GEMINI_API_KEY environment variable is not set');
        }
        else {
            Logger_1.logger.debug('✅ GEMINI_API_KEY is configured');
        }
        if (!process.env.BRIGHT_DATA_API_KEY) {
            Logger_1.logger.warn('BRIGHT_DATA_API_KEY environment variable is not set (required for DeepThinking mode)');
        }
        else {
            Logger_1.logger.debug('✅ BRIGHT_DATA_API_KEY is configured');
        }
        if (!process.env.LINKUP_API_KEY) {
            Logger_1.logger.warn('LINKUP_API_KEY environment variable is not set (required for Entity Search)');
        }
        else {
            Logger_1.logger.debug('✅ LINKUP_API_KEY is configured');
        }
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            Logger_1.logger.warn('SUPABASE_URL or SUPABASE_ANON_KEY not set (required for Dataset Matching)');
        }
        else {
            Logger_1.logger.debug('✅ SUPABASE credentials are configured');
        }
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            Logger_1.logger.warn('GMAIL_USER or GMAIL_APP_PASSWORD not set (required for Demo Email Service)');
        }
        else {
            Logger_1.logger.debug('✅ Gmail credentials are configured');
        }
        Logger_1.logger.info('✅ Ready to accept requests...');
    });
}
exports.default = app;
//# sourceMappingURL=app.js.map