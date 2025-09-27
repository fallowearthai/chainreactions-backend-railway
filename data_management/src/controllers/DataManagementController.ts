import { Request, Response } from 'express';
import { SupabaseService } from '@/services/SupabaseService';
import { CsvImportService } from '@/services/CsvImportService';
import { ApiResponse, PaginationParams, CreateDatasetRequest, UpdateDatasetRequest } from '@/types/DataTypes';
import * as path from 'path';
import * as fs from 'fs';

export class DataManagementController {
  private supabaseService: SupabaseService;
  private csvImportService: CsvImportService;

  constructor() {
    this.supabaseService = SupabaseService.getInstance();
    this.csvImportService = CsvImportService.getInstance();
  }

  // Dataset Management Endpoints

  /**
   * GET /api/datasets
   */
  async getDatasets(req: Request, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20' } = req.query;

      const result = await this.supabaseService.getDatasets(Number(page), Number(limit));

      const response: ApiResponse = {
        success: true,
        data: {
          datasets: result.datasets,
          total: result.total,
          page: Number(page),
          limit: Number(limit)
        }
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'Failed to fetch datasets');
    }
  }

  /**
   * GET /api/datasets/:id
   */
  async getDatasetById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const dataset = await this.supabaseService.getDatasetById(id);

      if (!dataset) {
        res.status(404).json({
          success: false,
          error: 'Dataset not found'
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: dataset
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'Failed to fetch dataset');
    }
  }

  /**
   * POST /api/datasets
   */
  async createDataset(req: Request, res: Response): Promise<void> {
    try {
      const datasetData: CreateDatasetRequest = req.body;

      // Validate required fields
      if (!datasetData.name) {
        res.status(400).json({
          success: false,
          error: 'Dataset name is required'
        });
        return;
      }

      const dataset = await this.supabaseService.createDataset(datasetData);

      const response: ApiResponse = {
        success: true,
        data: dataset,
        message: 'Dataset created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error, 'Failed to create dataset');
    }
  }

  /**
   * PUT /api/datasets/:id
   */
  async updateDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates: UpdateDatasetRequest = req.body;

      const dataset = await this.supabaseService.updateDataset(id, updates);

      const response: ApiResponse = {
        success: true,
        data: dataset,
        message: 'Dataset updated successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'Failed to update dataset');
    }
  }

  /**
   * DELETE /api/datasets/:id
   */
  async deleteDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await this.supabaseService.deleteDataset(id);

      const response: ApiResponse = {
        success: true,
        message: 'Dataset deleted successfully'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'Failed to delete dataset');
    }
  }

  /**
   * GET /api/datasets/:id/entries
   */
  async getDatasetEntries(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { page = '1', limit = '50', search } = req.query;

      let result;
      if (search) {
        result = await this.supabaseService.searchDatasetEntries(
          id,
          search as string,
          Number(page),
          Number(limit)
        );
      } else {
        result = await this.supabaseService.getDatasetEntries(
          id,
          Number(page),
          Number(limit)
        );
      }

      // Get dataset info
      const dataset = await this.supabaseService.getDatasetById(id);

      const response: ApiResponse = {
        success: true,
        data: {
          entries: result.entries,
          total: result.total,
          page: Number(page),
          limit: Number(limit),
          dataset_info: dataset ? {
            id: dataset.id,
            name: dataset.name,
            description: dataset.description
          } : null
        }
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'Failed to fetch dataset entries');
    }
  }

  /**
   * GET /api/datasets/:id/stats
   */
  async getDatasetStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const stats = await this.supabaseService.getDatasetStats(id);

      const response: ApiResponse = {
        success: true,
        data: stats
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'Failed to fetch dataset statistics');
    }
  }

  // File Upload and Import Endpoints

  /**
   * POST /api/datasets/:id/upload
   */
  async uploadFile(req: Request, res: Response): Promise<void> {
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
      console.log(`Processing uploaded file: ${file.originalname} (${file.size} bytes)`);

      // Validate file type
      const allowedExtensions = ['.csv', '.xml', '.json', '.js'];
      const fileExtension = path.extname(file.originalname).toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        res.status(400).json({
          success: false,
          error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`
        });
        return;
      }

      // Use a default dataset configuration for now to bypass Supabase API issue
      const dataset = {
        id: id,
        name: 'Uploaded Dataset',
        description: 'Smart CSV Upload',
        is_system: false
      };

      let importResult;

      // Process based on file type
      if (fileExtension === '.csv') {
        importResult = await this.csvImportService.importCsvFileSmart(
          file.path,
          dataset.name,
          dataset.description,
          dataset.is_system
        );
      } else {
        // For XML/JSON files, use existing processing logic
        // This would need to be implemented based on the frontend logic
        res.status(400).json({
          success: false,
          error: 'XML/JSON processing not yet implemented in backend'
        });
        return;
      }

      // Clean up uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError);
      }

      const response: ApiResponse = {
        success: importResult.success,
        data: importResult,
        message: importResult.success ?
          `Successfully imported ${importResult.importedRows}/${importResult.totalRows} entries` :
          'Import failed'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'File upload failed');
    }
  }

  /**
   * POST /api/import/nro-targets
   */
  async importNroTargets(req: Request, res: Response): Promise<void> {
    try {
      const { file_path } = req.body;

      const filePath = file_path || '/Users/kanbei/Code/chainreactions_backend/targets.simple.csv';

      console.log(`Importing NRO targets from: ${filePath}`);

      const importResult = await this.csvImportService.importNroTargetsFile(filePath);

      const response: ApiResponse = {
        success: importResult.success,
        data: importResult,
        message: importResult.success ?
          `Successfully imported ${importResult.importedRows}/${importResult.totalRows} NRO entries` :
          'NRO import failed'
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'NRO targets import failed');
    }
  }

  /**
   * POST /api/datasets/:id/validate-file
   */
  async validateFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
        return;
      }

      const file = req.file;
      const fileExtension = path.extname(file.originalname).toLowerCase();

      let validationResult;

      if (fileExtension === '.csv') {
        validationResult = await this.csvImportService.validateCsvFormat(file.path);
      } else {
        validationResult = {
          valid: false,
          errors: ['Only CSV validation is currently supported'],
          warnings: []
        };
      }

      // Clean up uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup validation file:', cleanupError);
      }

      const response: ApiResponse = {
        success: validationResult.valid,
        data: validationResult
      };

      res.json(response);
    } catch (error) {
      this.handleError(res, error, 'File validation failed');
    }
  }

  /**
   * GET /api/datasets/:id/export
   */
  async exportDataset(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { format = 'csv' } = req.query;

      if (format !== 'csv') {
        res.status(400).json({
          success: false,
          error: 'Only CSV export is currently supported'
        });
        return;
      }

      // Get dataset info
      const dataset = await this.supabaseService.getDatasetById(id);
      if (!dataset) {
        res.status(404).json({
          success: false,
          error: 'Dataset not found'
        });
        return;
      }

      // Create temporary export file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${dataset.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`;
      const tempPath = path.join(process.env.UPLOAD_PATH || './uploads', filename);

      const success = await this.csvImportService.exportDatasetToCsv(id, tempPath);

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Export failed'
        });
        return;
      }

      // Send file as download
      res.download(tempPath, filename, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up file after download
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup export file:', cleanupError);
        }
      });

    } catch (error) {
      this.handleError(res, error, 'Dataset export failed');
    }
  }

  // Health Check
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test database connection
      await this.supabaseService.getDatasets(1, 1);

      const response: ApiResponse = {
        success: true,
        data: {
          status: 'healthy',
          service: 'data-management',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      res.json(response);
    } catch (error) {
      res.status(503).json({
        success: false,
        error: 'Service unhealthy',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Error handling helper
  private handleError(res: Response, error: unknown, message: string): void {
    console.error(message, error);

    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: message,
      details: error instanceof Error ? error.message : String(error)
    });
  }
}