"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestUploadController = void 0;
const SmartCsvParser_1 = require("../services/SmartCsvParser");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class TestUploadController {
    /**
     * POST /api/test-upload/:id
     * 测试智能CSV上传功能，直接返回解析结果
     */
    async testUploadFile(req, res) {
        try {
            const { id } = req.params;
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
                return;
            }
            const file = req.file;
            console.log(`🔍 Processing test upload: ${file.originalname} (${file.size} bytes)`);
            // 验证文件类型
            const allowedExtensions = ['.csv'];
            const fileExtension = path.extname(file.originalname).toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                res.status(400).json({
                    success: false,
                    error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`
                });
                return;
            }
            // 智能检测字段映射
            console.log('🔍 Analyzing CSV structure...');
            const fieldAnalysis = await SmartCsvParser_1.SmartCsvParser.detectFieldMapping(file.path);
            console.log('📊 Field mapping analysis:', {
                confidence: fieldAnalysis.confidence,
                prioritiesFound: fieldAnalysis.priorities.found,
                prioritiesMissing: fieldAnalysis.priorities.missing,
                totalFields: fieldAnalysis.headers.length
            });
            // 解析前几行数据作为示例
            const sampleRows = await this.parseSampleCsvData(file.path, fieldAnalysis.mapping, 3);
            // 清理上传的文件
            try {
                fs.unlinkSync(file.path);
            }
            catch (cleanupError) {
                console.warn('Failed to cleanup uploaded file:', cleanupError);
            }
            const response = {
                success: true,
                message: 'Smart CSV analysis completed',
                data: {
                    field_analysis: {
                        confidence: fieldAnalysis.confidence,
                        priorities_found: fieldAnalysis.priorities.found,
                        priorities_missing: fieldAnalysis.priorities.missing,
                        total_headers: fieldAnalysis.headers.length,
                        mapping: fieldAnalysis.mapping
                    },
                    sample_data: sampleRows,
                    file_info: {
                        filename: file.originalname,
                        size: file.size,
                        format: 'csv'
                    }
                }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Test upload failed:', error);
            res.status(500).json({
                success: false,
                error: 'Test upload failed',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * 解析CSV文件的前几行作为示例
     */
    async parseSampleCsvData(filePath, mapping, limit = 3) {
        return new Promise((resolve) => {
            const results = [];
            let count = 0;
            const fs = require('fs');
            const csv = require('csv-parser');
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                if (count < limit) {
                    try {
                        const transformedRow = SmartCsvParser_1.SmartCsvParser.transformRowData(row, mapping);
                        if (transformedRow.organization_name && transformedRow.organization_name.trim()) {
                            results.push(transformedRow);
                            count++;
                        }
                    }
                    catch (error) {
                        console.warn('Error transforming sample row:', error);
                    }
                }
            })
                .on('end', () => {
                console.log(`Sample parsing completed: ${results.length} sample rows`);
                resolve(results);
            })
                .on('error', (error) => {
                console.error('Error parsing sample CSV:', error);
                resolve([]);
            });
        });
    }
}
exports.TestUploadController = TestUploadController;
//# sourceMappingURL=TestUploadController.js.map