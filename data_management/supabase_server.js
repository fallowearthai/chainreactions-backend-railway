const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://keacwlgxmxhbzskiximn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlYWN3bGd4bXhoYnpza2l4aW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc4NzgsImV4cCI6MjA3NDQzMzg3OH0.0vVyepn845skGQPUsaxRurAuLzUNiO6oGMQeBbJiEb4';

console.log('🔑 Using Supabase URL:', supabaseUrl);
console.log('🔑 Using anon key from MCP');

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Simple upload middleware
const upload = multer({ dest: './uploads/' });

// Test endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'ChainReactions Data Management Service (Supabase Connected)',
    version: '1.0.0',
    status: 'running',
    port: PORT
  });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Test Supabase connection
    const { data, error } = await supabase.from('datasets').select('count', { count: 'exact' });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'data-management',
        timestamp: new Date().toISOString(),
        supabase_connected: true
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      details: error.message
    });
  }
});

// NRO import endpoint with actual Supabase integration
app.post('/api/import/nro-targets', async (req, res) => {
  const filePath = req.body.file_path || '/Users/kanbei/Code/chainreactions_backend/targets.simple.csv';

  console.log(`Starting NRO import from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    return res.status(400).json({
      success: false,
      error: `File not found: ${filePath}`
    });
  }

  try {
    const startTime = Date.now();

    // Find or create NRO dataset
    let { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*')
      .eq('name', 'Canadian Named Research Organizations (NRO)')
      .single();

    if (datasetError && datasetError.code !== 'PGRST116') {
      throw datasetError;
    }

    if (!dataset) {
      // Create new dataset
      const { data: newDataset, error: createError } = await supabase
        .from('datasets')
        .insert({
          name: 'Canadian Named Research Organizations (NRO)',
          description: 'Complete Canadian NRO dataset imported from CSV',
          is_system: true
        })
        .select()
        .single();

      if (createError) throw createError;
      dataset = newDataset;
    }

    console.log(`Using dataset: ${dataset.name} (${dataset.id})`);

    // Parse CSV and collect rows
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rows.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Parsed ${rows.length} rows from CSV`);

    // Clear existing entries for this dataset
    const { error: deleteError } = await supabase
      .from('dataset_entries')
      .delete()
      .eq('dataset_id', dataset.id);

    if (deleteError) {
      console.warn('Warning: Could not clear existing entries:', deleteError.message);
    }

    // Prepare entries for batch insert
    const entries = rows.map(row => ({
      dataset_id: dataset.id,
      external_id: row.id,
      organization_name: row.name,
      aliases: row.aliases ? [row.aliases] : [],
      schema_type: row.schema || 'Organization',
      birth_date: row.birth_date || null,
      countries: row.countries ? row.countries.split(',').map(c => c.trim()) : [],
      addresses: row.addresses || null,
      identifiers: row.identifiers || null,
      sanctions: row.sanctions || null,
      phones: row.phones || null,
      emails: row.emails || null,
      program_ids: row.program_ids || null,
      dataset_source: 'Canadian NRO CSV',
      first_seen: row.first_seen || null,
      last_seen: row.last_seen || null,
      last_change: row.last_change || null,
      metadata: {
        topics: row.topics || null,
        updated_at: row.updated_at || null,
        lang: row.lang || null
      }
    }));

    // Batch insert entries (Supabase has a limit, so we'll do in chunks)
    const BATCH_SIZE = 100;
    let importedRows = 0;
    const errors = [];

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase
        .from('dataset_entries')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
        errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
      } else {
        importedRows += data.length;
        console.log(`Imported batch ${i}-${i + batch.length}: ${data.length} entries`);
      }
    }

    const processingTime = Date.now() - startTime;

    // Get sample data for response
    const { data: sampleData } = await supabase
      .from('dataset_entries')
      .select('external_id, organization_name, aliases, countries')
      .eq('dataset_id', dataset.id)
      .limit(3);

    res.json({
      success: true,
      data: {
        totalRows: rows.length,
        importedRows: importedRows,
        skippedRows: rows.length - importedRows,
        duplicateRows: 0,
        errors: errors,
        warnings: [],
        processing_time_ms: processingTime,
        file_info: {
          filename: path.basename(filePath),
          size: fs.statSync(filePath).size,
          format: 'csv'
        },
        sample_data: sampleData ? sampleData.map(item => ({
          id: item.external_id,
          name: item.organization_name,
          aliases: Array.isArray(item.aliases) ? item.aliases.join(', ') : item.aliases,
          countries: Array.isArray(item.countries) ? item.countries.join(', ') : item.countries
        })) : []
      },
      message: `Successfully imported ${importedRows}/${rows.length} NRO entries into Supabase`
    });

  } catch (error) {
    console.error('NRO import error:', error);
    res.status(500).json({
      success: false,
      error: `NRO import failed: ${error.message}`
    });
  }
});

// File upload test endpoint with Supabase integration
app.post('/api/datasets/:id/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  const file = req.file;
  const datasetId = req.params.id;

  console.log(`Received file: ${file.originalname} (${file.size} bytes) for dataset ${datasetId}`);

  try {
    // Simple file validation
    const allowedExtensions = ['.csv', '.xml', '.json'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}`
      });
    }

    // Check if dataset exists
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (datasetError || !dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    // For CSV files, process and import
    if (fileExtension === '.csv') {
      const startTime = Date.now();

      // Parse CSV
      const rows = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv())
          .on('data', (row) => {
            rows.push(row);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Import logic similar to NRO import but for generic CSV
      const entries = rows.map(row => ({
        dataset_id: datasetId,
        external_id: row.id || null,
        organization_name: row.name || row.organization_name || 'Unknown',
        aliases: row.aliases ? [row.aliases] : [],
        metadata: row
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from('dataset_entries')
        .insert(entries)
        .select('id');

      if (insertError) {
        throw insertError;
      }

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          totalRows: rows.length,
          importedRows: insertedData.length,
          skippedRows: 0,
          processing_time_ms: processingTime,
          file_info: {
            filename: file.originalname,
            size: file.size,
            format: fileExtension.substring(1)
          }
        },
        message: `Successfully imported ${insertedData.length} entries`
      });
    } else {
      res.json({
        success: true,
        data: {
          file_info: {
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            extension: fileExtension
          }
        },
        message: 'File uploaded successfully (CSV processing only implemented)'
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: `Upload failed: ${error.message}`
    });
  } finally {
    // Clean up
    try {
      fs.unlinkSync(file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup file:', cleanupError);
    }
  }
});

// Get datasets endpoint
app.get('/api/datasets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('datasets')
      .select(`
        *,
        dataset_entries(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        datasets: data,
        total: data.length
      }
    });
  } catch (error) {
    console.error('Error fetching datasets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get dataset entries endpoint
app.get('/api/datasets/:id/entries', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '50', search } = req.query;

    let query = supabase
      .from('dataset_entries')
      .select('*')
      .eq('dataset_id', id);

    if (search) {
      query = query.or(`organization_name.ilike.%${search}%,aliases.cs.{${search}}`);
    }

    const { data, error, count } = await query
      .range((page - 1) * limit, page * limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        entries: data,
        total: count,
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete dataset endpoint
app.delete('/api/datasets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Deleting dataset: ${id}`);

    // First check if dataset exists
    const { data: dataset, error: fetchError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !dataset) {
      return res.status(404).json({
        success: false,
        error: 'Dataset not found'
      });
    }

    // First delete all dataset entries
    const { error: entriesDeleteError } = await supabase
      .from('dataset_entries')
      .delete()
      .eq('dataset_id', id);

    if (entriesDeleteError) {
      console.error('Error deleting dataset entries:', entriesDeleteError);
      return res.status(500).json({
        success: false,
        error: `Failed to delete dataset entries: ${entriesDeleteError.message}`
      });
    }

    // Then delete the dataset
    const { error: datasetDeleteError } = await supabase
      .from('datasets')
      .delete()
      .eq('id', id);

    if (datasetDeleteError) {
      console.error('Error deleting dataset:', datasetDeleteError);
      return res.status(500).json({
        success: false,
        error: `Failed to delete dataset: ${datasetDeleteError.message}`
      });
    }

    console.log(`Successfully deleted dataset: ${dataset.name} (${id})`);

    res.json({
      success: true,
      message: `Dataset "${dataset.name}" and all its entries have been deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting dataset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Data Management Service (Supabase Connected) running on port ${PORT}`);
  console.log(`📋 API documentation: http://localhost:${PORT}/`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Supabase URL: ${supabaseUrl}`);
});

module.exports = app;