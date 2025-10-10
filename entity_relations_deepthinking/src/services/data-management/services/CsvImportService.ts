import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { SupabaseService } from './SupabaseService';
import { SmartCsvParser } from './SmartCsvParser';
import { CsvRow, ImportResult, DatasetEntry, ValidationResult } from '../types/DataTypes';

export class CsvImportService {
  private static instance: CsvImportService;
  private supabaseService: SupabaseService;

  private constructor() {
    this.supabaseService = SupabaseService.getInstance();
  }

  public static getInstance(): CsvImportService {
    if (!CsvImportService.instance) {
      CsvImportService.instance = new CsvImportService();
    }
    return CsvImportService.instance;
  }

  /**
   * 智能导入CSV文件 - 自动检测字段格式
   */
  async importCsvFileSmart(
    filePath: string,
    datasetName: string,
    description?: string,
    isSystem: boolean = true
  ): Promise<ImportResult> {
    const startTime = process.hrtime.bigint();

    const result: ImportResult = {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      duplicateRows: 0,
      errors: [],
      warnings: [],
      processing_time_ms: 0,
      file_info: {
        filename: path.basename(filePath),
        size: 0,
        format: 'csv'
      }
    };

    try {
      // 验证文件存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`CSV file not found: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      result.file_info.size = stats.size;

      // 智能检测字段映射
      console.log('🔍 Analyzing CSV structure...');
      const fieldAnalysis = await SmartCsvParser.detectFieldMapping(filePath);

      console.log('📊 Field mapping analysis:', {
        confidence: fieldAnalysis.confidence,
        prioritiesFound: fieldAnalysis.priorities.found,
        prioritiesMissing: fieldAnalysis.priorities.missing,
        totalFields: fieldAnalysis.headers.length
      });

      result.warnings.push(`Field detection confidence: ${fieldAnalysis.confidence}`);
      result.warnings.push(`Priority fields found: ${fieldAnalysis.priorities.found.join(', ')}`);

      if (fieldAnalysis.priorities.missing.length > 0) {
        result.warnings.push(`Missing priority fields: ${fieldAnalysis.priorities.missing.join(', ')}`);
      }

      // 创建或获取数据集
      const dataset = await this.getOrCreateDataset(datasetName, description, isSystem);
      result.dataset_id = dataset.id;

      // 解析CSV数据
      console.log('📄 Parsing CSV data...');
      const rows = await this.parseSmartCsvFile(filePath, fieldAnalysis.mapping);
      result.totalRows = rows.length;

      console.log(`Processing ${rows.length} rows with smart mapping...`);

      // 验证解析质量
      const qualityCheck = SmartCsvParser.validateParseResult(rows, fieldAnalysis.mapping);
      console.log('✅ Data quality assessment:', qualityCheck);

      result.warnings.push(`Data quality: ${qualityCheck.quality}`);
      result.warnings.push(`Valid rows: ${qualityCheck.stats.validRows}/${qualityCheck.stats.totalRows}`);

      // 批量处理数据
      const batchSize = 50;
      const duplicateTracker = new Set<string>();

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const batchResult = await this.processSmartBatch(batch, dataset.id);

        result.importedRows += batchResult.imported;
        result.skippedRows += batchResult.skipped;
        result.duplicateRows += batchResult.duplicates;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);

        // 进度日志
        if (i % (batchSize * 2) === 0) {
          console.log(`Processed ${Math.min(i + batchSize, rows.length)}/${rows.length} rows`);
        }
      }

      result.success = result.importedRows > 0;

      const endTime = process.hrtime.bigint();
      result.processing_time_ms = Number(endTime - startTime) / 1000000;

      console.log(`✅ Smart import completed: ${result.importedRows}/${result.totalRows} rows imported`);

      return result;

    } catch (error) {
      console.error('❌ Smart CSV import failed:', error);
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);

      const endTime = process.hrtime.bigint();
      result.processing_time_ms = Number(endTime - startTime) / 1000000;

      return result;
    }
  }

  /**
   * Import NRO CSV file into Supabase (Legacy method)
   */
  async importCsvFile(
    filePath: string,
    datasetName: string,
    description?: string,
    isSystem: boolean = true
  ): Promise<ImportResult> {
    const startTime = process.hrtime.bigint();

    const result: ImportResult = {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      duplicateRows: 0,
      errors: [],
      warnings: [],
      processing_time_ms: 0,
      file_info: {
        filename: path.basename(filePath),
        size: 0,
        format: 'csv'
      }
    };

    try {
      // Verify file exists and get size
      if (!fs.existsSync(filePath)) {
        throw new Error(`CSV file not found: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      result.file_info.size = stats.size;

      // Validate CSV format first
      const validation = await this.validateCsvFormat(filePath);
      if (!validation.valid) {
        result.errors = validation.errors;
        return result;
      }

      if (validation.warnings.length > 0) {
        result.warnings = validation.warnings;
      }

      // Create or get dataset
      const dataset = await this.getOrCreateDataset(datasetName, description, isSystem);
      result.dataset_id = dataset.id;

      // Parse CSV
      const rows = await this.parseCsvFile(filePath);
      result.totalRows = rows.length;

      console.log(`Processing ${rows.length} rows from CSV file: ${path.basename(filePath)}`);

      // Process rows in batches for better performance
      const batchSize = 100;
      const duplicateTracker = new Set<string>();

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, dataset.id, duplicateTracker);

        result.importedRows += batchResult.imported;
        result.skippedRows += batchResult.skipped;
        result.duplicateRows += batchResult.duplicates;
        result.errors.push(...batchResult.errors);
        result.warnings.push(...batchResult.warnings);

        // Progress logging
        if (i % (batchSize * 5) === 0) {
          console.log(`Processed ${Math.min(i + batchSize, rows.length)}/${rows.length} rows`);
        }
      }

      result.success = result.importedRows > 0;

      const endTime = process.hrtime.bigint();
      result.processing_time_ms = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      console.log(`Import completed: ${result.importedRows}/${result.totalRows} rows imported, ${result.skippedRows} skipped, ${result.duplicateRows} duplicates`);

      return result;

    } catch (error) {
      console.error('CSV import failed:', error);
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);

      const endTime = process.hrtime.bigint();
      result.processing_time_ms = Number(endTime - startTime) / 1000000;

      return result;
    }
  }

  /**
   * Parse CSV file and return rows
   */
  private async parseCsvFile(filePath: string): Promise<CsvRow[]> {
    return new Promise((resolve, reject) => {
      const rows: CsvRow[] = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: any) => {
          // Convert to CsvRow type with proper field mapping
          const csvRow: CsvRow = {
            id: row.id || '',
            schema: row.schema || '',
            name: row.name || '',
            aliases: row.aliases || '',
            birth_date: row.birth_date || '',
            countries: row.countries || '',
            addresses: row.addresses || '',
            identifiers: row.identifiers || '',
            sanctions: row.sanctions || '',
            phones: row.phones || '',
            emails: row.emails || '',
            program_ids: row.program_ids || '',
            dataset: row.dataset || '',
            first_seen: row.first_seen || '',
            last_seen: row.last_seen || '',
            last_change: row.last_change || ''
          };
          rows.push(csvRow);
        })
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  /**
   * Process a batch of CSV rows
   */
  private async processBatch(
    rows: CsvRow[],
    datasetId: string,
    duplicateTracker: Set<string>
  ): Promise<{ imported: number; skipped: number; duplicates: number; errors: string[]; warnings: string[] }> {
    const result: { imported: number; skipped: number; duplicates: number; errors: string[]; warnings: string[] } = {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: [],
      warnings: []
    };

    for (const row of rows) {
      try {
        // Validate required fields
        if (!row.id || !row.name) {
          result.skipped++;
          result.errors.push(`Row skipped: missing id or name - Row: ${JSON.stringify(row)}`);
          continue;
        }

        // Check for duplicates within the batch
        if (duplicateTracker.has(row.id)) {
          result.duplicates++;
          result.warnings.push(`Duplicate ID found: ${row.id}`);
          continue;
        }

        duplicateTracker.add(row.id);

        // Convert row to DatasetEntry format
        const entry = this.convertRowToEntry(row, datasetId);

        // Check if entry already exists in database
        const existingEntry = await this.supabaseService.findEntryByExternalId(row.id);

        if (existingEntry) {
          // Update existing entry
          await this.supabaseService.updateDatasetEntry(existingEntry.id, entry);
          result.warnings.push(`Updated existing entry: ${row.id}`);
        } else {
          // Create new entry
          await this.supabaseService.createDatasetEntry(entry);
        }

        result.imported++;

      } catch (error) {
        result.skipped++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Row failed: ${errorMessage} - Row: ${JSON.stringify(row)}`);
      }
    }

    return result;
  }

  /**
   * Convert CSV row to DatasetEntry format
   */
  private convertRowToEntry(row: CsvRow, datasetId: string): any {
    // Parse aliases
    const aliases = row.aliases ?
      row.aliases.split(';').map((alias: string) => alias.trim()).filter((alias: string) => alias.length > 0) :
      [];

    // Parse countries
    const countries = row.countries ?
      row.countries.split(',').map((country: string) => country.trim()).filter((country: string) => country.length > 0) :
      [];

    // Parse dates
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    };

    const entry: any = {
      dataset_id: datasetId,
      external_id: row.id,
      organization_name: row.name,
      aliases: aliases.length > 0 ? aliases : [],
      schema_type: row.schema || 'Organization',
      countries: countries.length > 0 ? countries : [],
      metadata: {
        imported_at: new Date().toISOString(),
        source_file: path.basename(row.dataset || 'unknown'),
        original_row_id: row.id,
        schema_type: row.schema
      }
    };

    // Only add non-empty optional fields
    if (row.birth_date) entry.birth_date = row.birth_date;
    if (row.addresses) entry.addresses = row.addresses;
    if (row.identifiers) entry.identifiers = row.identifiers;
    if (row.sanctions) entry.sanctions = row.sanctions;
    if (row.phones) entry.phones = row.phones;
    if (row.emails) entry.emails = row.emails;
    if (row.program_ids) entry.program_ids = row.program_ids;
    if (row.dataset) entry.dataset_source = row.dataset;
    if (parseDate(row.first_seen)) entry.first_seen = parseDate(row.first_seen);
    if (parseDate(row.last_seen)) entry.last_seen = parseDate(row.last_seen);
    if (parseDate(row.last_change)) entry.last_change = parseDate(row.last_change);

    return entry;
  }

  /**
   * Get or create dataset
   */
  private async getOrCreateDataset(
    name: string,
    description?: string,
    isSystem: boolean = true
  ) {
    try {
      // Check if dataset already exists
      const existingDataset = await this.supabaseService.findDatasetByName(name);

      if (existingDataset) {
        console.log(`Using existing dataset: ${name}`);
        return existingDataset;
      }

      // Create new dataset
      console.log(`Creating new dataset: ${name}`);
      return await this.supabaseService.createDataset({
        name,
        description: description || `Imported dataset: ${name}`,
        is_system: isSystem
      });

    } catch (error) {
      throw new Error(`Failed to create dataset: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Import the targets.simple.csv file specifically
   */
  async importNroTargetsFile(filePath: string = '/Users/kanbei/Code/chainreactions_backend/targets.simple.csv'): Promise<ImportResult> {
    return this.importCsvFile(
      filePath,
      'Canadian Named Research Organizations',
      'Canadian government list of named research organizations with security concerns',
      true
    );
  }

  /**
   * Validate CSV format before import
   */
  async validateCsvFormat(filePath: string): Promise<ValidationResult> {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    try {
      if (!fs.existsSync(filePath)) {
        result.errors.push('File does not exist');
        result.valid = false;
        return result;
      }

      // Check file extension
      if (!filePath.toLowerCase().endsWith('.csv')) {
        result.errors.push('File must have .csv extension');
        result.valid = false;
      }

      // Check file size (max 100MB)
      const stats = fs.statSync(filePath);
      if (stats.size > 100 * 1024 * 1024) {
        result.errors.push('File size exceeds 100MB limit');
        result.valid = false;
      }

      // Read first few rows to validate structure
      const rows: any[] = [];
      await new Promise<void>((resolve, reject) => {
        let rowCount = 0;
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row: any) => {
            if (rowCount < 10) { // Check first 10 rows
              rows.push(row);
              rowCount++;
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      if (rows.length === 0) {
        result.errors.push('CSV file appears to be empty');
        result.valid = false;
        return result;
      }

      // Check required columns
      const requiredColumns = ['id', 'name'];
      const firstRow = rows[0];
      const availableColumns = Object.keys(firstRow);
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));

      if (missingColumns.length > 0) {
        result.errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
        result.valid = false;
      }

      // Check for common issues
      let emptyNameCount = 0;
      let emptyIdCount = 0;

      rows.forEach((row, index) => {
        if (!row.id || row.id.trim() === '') {
          emptyIdCount++;
        }
        if (!row.name || row.name.trim() === '') {
          emptyNameCount++;
        }
      });

      if (emptyIdCount > rows.length * 0.1) {
        result.warnings.push(`${emptyIdCount} rows have empty IDs`);
      }

      if (emptyNameCount > rows.length * 0.1) {
        result.warnings.push(`${emptyNameCount} rows have empty names`);
      }

      result.valid = result.errors.length === 0;
      result.metadata = {
        row_count: rows.length,
        columns: availableColumns,
        encoding: 'utf8' // Could be enhanced to detect encoding
      };

      return result;

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      result.valid = false;
      return result;
    }
  }

  /**
   * Export dataset to CSV format
   */
  async exportDatasetToCsv(datasetId: string, outputPath: string, format: 'user-friendly' | 'technical' = 'user-friendly'): Promise<boolean> {
    try {
      const { entries } = await this.supabaseService.getDatasetEntries(datasetId, 1, 10000); // Get all entries

      const csvContent = format === 'user-friendly'
        ? this.convertEntriesToUserFriendlyCsv(entries)
        : this.convertEntriesToCsv(entries);

      fs.writeFileSync(outputPath, csvContent, 'utf8');

      console.log(`Exported ${entries.length} entries to ${outputPath} in ${format} format`);
      return true;

    } catch (error) {
      console.error('Export failed:', error);
      return false;
    }
  }

  /**
   * Convert entries to user-friendly CSV format (4 columns)
   */
  private convertEntriesToUserFriendlyCsv(entries: DatasetEntry[]): string {
    if (entries.length === 0) return '';

    // CSV header - user-friendly format
    const header = ['Entity Name', 'Country', 'Type', 'Aliases'];

    // Convert entries to CSV rows
    const rows = entries.map(entry => [
      `"${entry.organization_name}"`,
      entry.countries && entry.countries.length > 0 ? entry.countries.join(', ') : 'N/A',
      entry.schema_type || 'Organization',
      entry.aliases && entry.aliases.length > 0 ? `"${entry.aliases.join('; ')}"` : 'No aliases'
    ]);

    // Combine header and rows
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Convert entries to technical CSV format (15 columns)
   */
  private convertEntriesToCsv(entries: DatasetEntry[]): string {
    if (entries.length === 0) return '';

    // CSV header
    const header = [
      'id', 'schema', 'name', 'aliases', 'birth_date', 'countries',
      'addresses', 'identifiers', 'sanctions', 'phones', 'emails',
      'program_ids', 'dataset', 'first_seen', 'last_seen', 'last_change'
    ];

    // Convert entries to CSV rows
    const rows = entries.map(entry => [
      entry.external_id || entry.id,
      entry.schema_type || 'Organization',
      `"${entry.organization_name}"`,
      entry.aliases ? `"${entry.aliases.join(';')}"` : '',
      entry.birth_date || '',
      entry.countries ? entry.countries.join(',') : '',
      entry.addresses ? `"${entry.addresses}"` : '',
      entry.identifiers ? `"${entry.identifiers}"` : '',
      entry.sanctions ? `"${entry.sanctions}"` : '',
      entry.phones ? `"${entry.phones}"` : '',
      entry.emails ? `"${entry.emails}"` : '',
      entry.program_ids ? `"${entry.program_ids}"` : '',
      entry.dataset_source || '',
      entry.first_seen ? entry.first_seen.toISOString() : '',
      entry.last_seen ? entry.last_seen.toISOString() : '',
      entry.last_change ? entry.last_change.toISOString() : ''
    ]);

    // Combine header and rows
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * 解析智能CSV文件
   */
  private async parseSmartCsvFile(filePath: string, mapping: Record<string, string>): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: any) => {
          try {
            const transformedRow = SmartCsvParser.transformRowData(row, mapping);
            if (transformedRow.organization_name && transformedRow.organization_name.trim()) {
              results.push(transformedRow);
            }
          } catch (error) {
            console.warn('Error transforming row:', error, row);
          }
        })
        .on('end', () => {
          console.log(`Smart CSV parsing completed: ${results.length} valid rows`);
          resolve(results);
        })
        .on('error', (error: any) => {
          console.error('Error parsing smart CSV:', error);
          reject(error);
        });
    });
  }

  /**
   * 处理智能批次数据
   */
  private async processSmartBatch(
    batch: any[],
    datasetId: string
  ): Promise<{ imported: number; skipped: number; duplicates: number; errors: string[]; warnings: string[] }> {
    const result: { imported: number; skipped: number; duplicates: number; errors: string[]; warnings: string[] } = {
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: [],
      warnings: []
    };

    const entries: Partial<DatasetEntry>[] = [];
    const duplicateTracker = new Set<string>();

    for (const row of batch) {
      try {
        // 验证必需字段
        if (!row.organization_name || !row.organization_name.trim()) {
          result.skipped++;
          result.errors.push(`Row skipped: missing organization name`);
          continue;
        }

        // 创建唯一标识符用于重复检测
        const uniqueKey = row.external_id || row.organization_name.toLowerCase().trim();

        if (duplicateTracker.has(uniqueKey)) {
          result.duplicates++;
          result.warnings.push(`Duplicate entry: ${uniqueKey}`);
          continue;
        }

        duplicateTracker.add(uniqueKey);

        // 转换为数据库条目格式
        const entry: Partial<DatasetEntry> = {
          dataset_id: datasetId,
          organization_name: row.organization_name.trim(),
          schema_type: row.schema_type || 'Organization',
          metadata: {
            imported_at: new Date().toISOString(),
            smart_parsed: true,
            ...row.metadata
          }
        };

        // Only add non-null optional fields
        if (row.external_id) entry.external_id = row.external_id;
        if (row.aliases) entry.aliases = row.aliases;
        if (row.birth_date) entry.birth_date = row.birth_date;
        if (row.countries) entry.countries = row.countries;
        if (row.addresses) entry.addresses = row.addresses;
        if (row.identifiers) entry.identifiers = row.identifiers;
        if (row.sanctions) entry.sanctions = row.sanctions;
        if (row.phones) entry.phones = row.phones;
        if (row.emails) entry.emails = row.emails;
        if (row.program_ids) entry.program_ids = row.program_ids;
        if (row.dataset_source) entry.dataset_source = row.dataset_source;
        if (row.first_seen) entry.first_seen = row.first_seen;
        if (row.last_seen) entry.last_seen = row.last_seen;
        if (row.last_change) entry.last_change = row.last_change;

        entries.push(entry);

      } catch (error) {
        result.skipped++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Row processing failed: ${errorMessage}`);
      }
    }

    // 批量插入到数据库
    if (entries.length > 0) {
      try {
        console.log(`🔄 Attempting to insert ${entries.length} entries into database...`);
        console.log(`📝 Sample entry:`, JSON.stringify(entries[0], null, 2));

        await this.supabaseService.createDatasetEntries(entries);
        result.imported = entries.length;
        console.log(`✅ Successfully imported ${entries.length} entries`);
      } catch (error) {
        console.error(`❌ Database insertion failed:`, error);
        result.skipped += entries.length;
        result.imported = 0;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Batch insertion failed: ${errorMessage}`);
        console.error(`❌ Error details:`, errorMessage);
      }
    } else {
      console.log(`⚠️ No entries to insert (entries.length = 0)`);
    }

    return result;
  }
}