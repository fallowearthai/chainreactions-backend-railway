"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables first
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const dataRoutes_1 = __importDefault(require("./routes/dataRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3004;
// Security middleware
app.use((0, helmet_1.default)());
// CORS configuration
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:8080',
        'http://localhost:3000',
        'http://localhost:8081',
        'http://localhost:8082',
        'http://localhost:8083'
    ].concat(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Compression middleware
app.use((0, compression_1.default)());
// Logging middleware
app.use((0, morgan_1.default)(process.env.LOG_FORMAT || 'combined'));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Static files for uploads (if needed for testing)
const uploadPath = process.env.UPLOAD_PATH || './uploads';
app.use('/uploads', express_1.default.static(uploadPath));
// API routes
app.use(process.env.API_PREFIX || '/api', dataRoutes_1.default);
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'ChainReactions Data Management Service',
        version: '1.0.0',
        status: 'running',
        port: PORT,
        endpoints: {
            health: '/api/health',
            datasets: '/api/datasets',
            upload: '/api/datasets/:id/upload',
            import_nro: '/api/import/nro-targets'
        },
        documentation: 'https://github.com/chainreactions/backend/tree/main/data_management'
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(err.status || 500).json({
        success: false,
        error: 'Internal server error',
        message: isDevelopment ? err.message : 'Something went wrong',
        ...(isDevelopment && { stack: err.stack })
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});
// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});
// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Data Management Service running on port ${PORT}`);
        console.log(`📁 Upload path: ${uploadPath}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📋 API documentation: http://localhost:${PORT}/`);
    });
}
exports.default = app;
//# sourceMappingURL=app.js.map