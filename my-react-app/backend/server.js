const express = require('express');
const mysql = require('mysql2/promise');
const rateLimit = require("express-rate-limit");
const cors = require('cors');
const session = require('express-session');
const nodemailer = require("nodemailer");
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const stream = require('stream');
const app = express();
const fs = require('fs').promises; 

require('dotenv').config();

const NG_URL = process.env.NGROK_URL;

app.use(cors({
    origin: NG_URL,
    credentials: true
}));

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString('utf8');
    }
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));




const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

app.use(session({
    secret: process.env.SESSION_SECRET || process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 15
    }
}));

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.NODE_MAIL,
        pass: process.env.NODE_PASS
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, ''));
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use('/api/', limiter);



app.get('/api/dashboard/', (req, res) => {

});

// Configure multer to use memory storage 
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/datasets');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `dataset-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedExt = ['.csv', '.json', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExt.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only CSV, JSON, and Excel files are allowed.'));
        }
    }
});



app.post('/api/upload', upload.single('dataset'), async (req, res) => {
    let connection;
    
    try {
        // Check authentication
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        // Check if user is admin
        const [users] = await db.execute(
            'SELECT role FROM User WHERE user_id = ?',
            [req.session.userId]
        );
        
        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized. Admin access required.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Parse form data (coming as JSON string in the 'metadata' field)
        let metadata = {};
        if (req.body.metadata) {
            try {
                metadata = JSON.parse(req.body.metadata);
            } catch (e) {
                metadata = req.body;
            }
        } else {
            metadata = req.body;
        }

        // Validate required fields
        const requiredFields = ['title', 'description', 'author'];
        for (const field of requiredFields) {
            if (!metadata[field]) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: `Missing required field: ${field}`
                });
            }
        }

        // Process tags and columns (convert arrays to comma-separated strings)
        const tags = Array.isArray(metadata.tags) ? metadata.tags.join(',') : metadata.tags || '';
        const columns = Array.isArray(metadata.columns) ? metadata.columns.join(',') : metadata.columns || '';

        // Insert dataset metadata into database
        const [result] = await connection.execute(
            `INSERT INTO Dataset (
                title, 
                description, 
                category, 
                author, 
                format, 
                size, 
                tags,
                columns,
                version, 
                license, 
                source, 
                methodology, 
                update_frequency, 
                is_public,
                file_name,
                file_size,
                uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                metadata.title,
                metadata.description,
                metadata.category || 'uncategorized',
                metadata.author,
                metadata.format || 'CSV',
                metadata.size || formatFileSize(req.file.size),
                tags,
                columns,
                metadata.version || '1.0.0',
                metadata.license || 'MIT',
                metadata.source || null,
                metadata.methodology || null,
                metadata.updateFrequency || 'one-time',
                metadata.isPublic === 'true' || metadata.isPublic === true ? 1 : 1, // Default to public
                req.file.filename,
                req.file.size,
                req.session.userId
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Dataset uploaded successfully',
            dataset: {
                id: result.insertId,
                title: metadata.title,
                description: metadata.description,
                category: metadata.category,
                file: req.file.filename,
                tags: metadata.tags,
                columns: metadata.columns
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Upload error:', error);
        
        // Clean up uploaded file if transaction fails
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error cleaning up file:', unlinkError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to upload dataset: ' + error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// New endpoint to get all datasets
app.get('/api/datasets', async (req, res) => {
    try {
        const { category, search, limit = 20, offset = 0 } = req.query;
        
        // Ensure limit and offset are valid integers
        const parsedLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
        const parsedOffset = Math.max(0, parseInt(offset) || 0);
        
        let query = `
            SELECT 
                d.*,
                u.name as uploader_name
            FROM Dataset d
            LEFT JOIN User u ON d.uploaded_by = u.user_id
            WHERE d.is_public = 1
        `;
        
        const params = [];
        
        if (category && category !== 'all') {
            query += ' AND d.category = ?';
            params.push(category);
        }
        
        if (search) {
            query += ' AND (d.title LIKE ? OR d.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(parsedLimit, 10), parseInt(parsedOffset, 10));
        
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const [datasets] = await db.query(query, params);
        
        // Process tags and columns for each dataset
        const processedDatasets = datasets.map(dataset => ({
            ...dataset,
            tags: dataset.tags ? dataset.tags.split(',') : [],
            columns: dataset.columns ? dataset.columns.split(',') : []
        }));
        
        // Get total count
        const [countResult] = await db.execute(
            'SELECT COUNT(*) as total FROM Dataset WHERE is_public = 1',
            []
        );
        
        res.json({
            success: true,
            datasets: processedDatasets,
            total: countResult[0].total,
            limit: parsedLimit,
            offset: parsedOffset
        });
        
    } catch (error) {
        console.error('Error fetching datasets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch datasets: ' + error.message
        });
    }
});

// Get single dataset by ID
app.get('/api/datasets/:id', async (req, res) => {
    try {
        const datasetId = req.params.id;
        
        const [datasets] = await db.execute(
            `SELECT 
                d.*,
                u.name as uploader_name,
                u.email as uploader_email
            FROM Dataset d
            LEFT JOIN User u ON d.uploaded_by = u.user_id
            WHERE d.dataset_id = ?`,
            [datasetId]
        );
        
        if (datasets.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Dataset not found'
            });
        }
        
        const dataset = datasets[0];
        dataset.tags = dataset.tags ? dataset.tags.split(',') : [];
        dataset.columns = dataset.columns ? dataset.columns.split(',') : [];
        
        // Increment view count
        await db.execute(
            'UPDATE Dataset SET views = views + 1 WHERE dataset_id = ?',
            [datasetId]
        );
        
        res.json({
            success: true,
            dataset: dataset
        });
        
    } catch (error) {
        console.error('Error fetching dataset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dataset'
        });
    }
});

// Add this to server.js
app.get('/api/datasets/:id/preview', async (req, res) => {
    try {
        const datasetId = req.params.id;
        
        // Get the file path from database
        const [datasets] = await db.execute(
            'SELECT file_name, format FROM Dataset WHERE dataset_id = ?',
            [datasetId]
        );
        
        if (datasets.length === 0 || !datasets[0].file_name) {
            return res.status(404).json({
                success: false,
                error: 'Dataset file not found'
            });
        }
        
        const dataset = datasets[0];
        const filePath = path.join(__dirname, '../uploads/datasets', dataset.file_name);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'File not found on server'
            });
        }
        
        // Read and parse the file
        const fileContent = await fs.readFile(filePath, 'utf-8');
        let previewRows = [];
        let columns = [];
        
        if (dataset.format.toLowerCase() === 'csv') {
            // Parse CSV
            const lines = fileContent.split('\n');
            if (lines.length > 0) {
                columns = lines[0].split(',').map(col => col.trim().replace(/["']/g, ''));
                
                // Get first 5 rows (skip header)
                for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
                    const values = lines[i].split(',').map(val => val.trim().replace(/["']/g, ''));
                    const row = {};
                    columns.forEach((col, idx) => {
                        row[col] = values[idx] || '';
                    });
                    previewRows.push(row);
                }
            }
        } else if (dataset.format.toLowerCase() === 'json') {
            // Parse JSON
            const jsonData = JSON.parse(fileContent);
            if (Array.isArray(jsonData) && jsonData.length > 0) {
                columns = Object.keys(jsonData[0]);
                previewRows = jsonData.slice(0, 5);
            } else if (jsonData.data && Array.isArray(jsonData.data)) {
                columns = Object.keys(jsonData.data[0]);
                previewRows = jsonData.data.slice(0, 5);
            }
        }
        
        res.json({
            success: true,
            preview: {
                columns: columns,
                rows: previewRows,
                totalRows: previewRows.length
            }
        });
        
    } catch (error) {
        console.error('Error reading preview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load preview data'
        });
    }
});

// Download dataset file
app.get('/api/datasets/:id/download', async (req, res) => {
    try {
        const datasetId = req.params.id;
        
        const [datasets] = await db.execute(
            'SELECT file_name, title FROM Dataset WHERE dataset_id = ?',
            [datasetId]
        );
        
        if (datasets.length === 0 || !datasets[0].file_name) {
            return res.status(404).json({
                success: false,
                error: 'Dataset file not found'
            });
        }
        
        const dataset = datasets[0];
        const filePath = path.join(__dirname, '../uploads/datasets', dataset.file_name);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'File not found on server'
            });
        }
        
        // Increment download count
        await db.execute(
            'UPDATE Dataset SET downloads = downloads + 1 WHERE dataset_id = ?',
            [datasetId]
        );
        
        // Send file
        res.download(filePath, `${dataset.title}.csv`);
        
    } catch (error) {
        console.error('Error downloading dataset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download dataset'
        });
    }
});

app.get('/api/datasets/:id/annotations', async (req, res) => {
    try {
        const datasetId = req.params.id;
        const { includeResolved = false } = req.query;
        
        let query = `
            SELECT 
                da.*,
                u.name as user_name,
                u.picture as user_picture,
                COUNT(DISTINCT av.vote_id) as vote_count,
                SUM(CASE WHEN av.vote_type = 'upvote' THEN 1 ELSE 0 END) as upvotes,
                SUM(CASE WHEN av.vote_type = 'downvote' THEN 1 ELSE 0 END) as downvotes,
                (SELECT COUNT(*) FROM DatasetAnnotation WHERE parent_annotation_id = da.annotation_id) as reply_count
            FROM DatasetAnnotation da
            LEFT JOIN User u ON da.user_id = u.user_id
            LEFT JOIN AnnotationVote av ON da.annotation_id = av.annotation_id
            WHERE da.dataset_id = ? 
            ${includeResolved === 'true' ? '' : 'AND da.is_resolved = 0'}
            AND da.parent_annotation_id IS NULL
            GROUP BY da.annotation_id
            ORDER BY da.created_at DESC
        `;
        
        const [annotations] = await db.execute(query, [datasetId]);
        
        // Get replies for each annotation
        for (let annotation of annotations) {
            const [replies] = await db.execute(`
                SELECT 
                    da.*,
                    u.name as user_name,
                    u.picture as user_picture
                FROM DatasetAnnotation da
                LEFT JOIN User u ON da.user_id = u.user_id
                WHERE da.parent_annotation_id = ?
                ORDER BY da.created_at ASC
            `, [annotation.annotation_id]);
            
            annotation.replies = replies;
        }
        
        res.json({
            success: true,
            annotations: annotations
        });
        
    } catch (error) {
        console.error('Error fetching annotations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch annotations'
        });
    }
});

// Get data point annotations for a dataset
app.get('/api/datasets/:id/data-annotations', async (req, res) => {
    try {
        const datasetId = req.params.id;
        
        const [annotations] = await db.execute(`
            SELECT 
                dpa.*,
                u.name as user_name,
                u.picture as user_picture
            FROM DataPointAnnotation dpa
            LEFT JOIN User u ON dpa.user_id = u.user_id
            WHERE dpa.dataset_id = ?
            ORDER BY dpa.row_index, dpa.column_name
        `, [datasetId]);
        
        res.json({
            success: true,
            annotations: annotations
        });
        
    } catch (error) {
        console.error('Error fetching data annotations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch data annotations'
        });
    }
});

// Add a new annotation
app.post('/api/datasets/:id/annotations', async (req, res) => {
    let connection;
    
    try {
        // Check authentication
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const datasetId = req.params.id;
        const { 
            annotation_text, 
            annotation_type = 'general', 
            parent_annotation_id = null 
        } = req.body;
        
        if (!annotation_text || annotation_text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Annotation text is required'
            });
        }
        
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        // Insert annotation
        const [result] = await connection.execute(
            `INSERT INTO DatasetAnnotation (
                dataset_id, 
                user_id, 
                annotation_text, 
                annotation_type,
                parent_annotation_id
            ) VALUES (?, ?, ?, ?, ?)`,
            [datasetId, req.session.userId, annotation_text, annotation_type, parent_annotation_id]
        );
        
        // Get the created annotation with user info
        const [newAnnotation] = await connection.execute(`
            SELECT 
                da.*,
                u.name as user_name,
                u.picture as user_picture,
                0 as vote_count,
                0 as upvotes,
                0 as downvotes,
                0 as reply_count
            FROM DatasetAnnotation da
            LEFT JOIN User u ON da.user_id = u.user_id
            WHERE da.annotation_id = ?
        `, [result.insertId]);
        
        await connection.commit();
        
        res.json({
            success: true,
            message: 'Annotation added successfully',
            annotation: newAnnotation[0]
        });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding annotation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add annotation'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Add a data point annotation
app.post('/api/datasets/:id/data-annotations', async (req, res) => {
    let connection;
    
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const datasetId = req.params.id;
        const { 
            row_index, 
            column_name, 
            original_value,
            annotation_text, 
            annotation_type = 'note',
            suggested_correction = null
        } = req.body;
        
        if (!annotation_text || annotation_text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Annotation text is required'
            });
        }
        
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        const [result] = await connection.execute(
            `INSERT INTO DataPointAnnotation (
                dataset_id, 
                user_id, 
                row_index, 
                column_name,
                original_value,
                annotation_text, 
                annotation_type,
                suggested_correction
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [datasetId, req.session.userId, row_index, column_name, original_value, annotation_text, annotation_type, suggested_correction]
        );
        
        await connection.commit();
        
        res.json({
            success: true,
            message: 'Data annotation added successfully',
            annotation_id: result.insertId
        });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding data annotation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add data annotation'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Vote on an annotation
app.post('/api/annotations/:id/vote', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const annotationId = req.params.id;
        const { vote_type = 'upvote' } = req.body;
        
        // Check if user already voted
        const [existingVote] = await db.execute(
            'SELECT * FROM AnnotationVote WHERE annotation_id = ? AND user_id = ?',
            [annotationId, req.session.userId]
        );
        
        if (existingVote.length > 0) {
            // Update existing vote
            await db.execute(
                'UPDATE AnnotationVote SET vote_type = ? WHERE annotation_id = ? AND user_id = ?',
                [vote_type, annotationId, req.session.userId]
            );
        } else {
            // Insert new vote
            await db.execute(
                'INSERT INTO AnnotationVote (annotation_id, user_id, vote_type) VALUES (?, ?, ?)',
                [annotationId, req.session.userId, vote_type]
            );
        }
        
        // Get updated vote counts
        const [voteCounts] = await db.execute(`
            SELECT 
                COUNT(*) as total_votes,
                SUM(CASE WHEN vote_type = 'upvote' THEN 1 ELSE 0 END) as upvotes,
                SUM(CASE WHEN vote_type = 'downvote' THEN 1 ELSE 0 END) as downvotes
            FROM AnnotationVote
            WHERE annotation_id = ?
        `, [annotationId]);
        
        res.json({
            success: true,
            message: 'Vote recorded',
            votes: voteCounts[0]
        });
        
    } catch (error) {
        console.error('Error voting on annotation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record vote'
        });
    }
});

// Resolve an annotation (admin or annotation owner only)
app.put('/api/annotations/:id/resolve', async (req, res) => {
    let connection;
    
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const annotationId = req.params.id;
        
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        // Check if user is admin or annotation owner
        const [annotation] = await connection.execute(
            `SELECT da.*, u.role 
             FROM DatasetAnnotation da
             JOIN User u ON da.user_id = u.user_id
             WHERE da.annotation_id = ?`,
            [annotationId]
        );
        
        if (annotation.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annotation not found'
            });
        }
        
        const isOwner = annotation[0].user_id === req.session.userId;
        const isAdmin = annotation[0].role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized to resolve this annotation'
            });
        }
        
        await connection.execute(
            'UPDATE DatasetAnnotation SET is_resolved = NOT is_resolved WHERE annotation_id = ?',
            [annotationId]
        );
        
        await connection.commit();
        
        res.json({
            success: true,
            message: 'Annotation resolution toggled'
        });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error resolving annotation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve annotation'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Delete annotation
app.delete('/api/annotations/:id', async (req, res) => {
    let connection;
    
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const annotationId = req.params.id;
        
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        // Check permissions
        const [annotation] = await connection.execute(
            `SELECT da.*, u.role 
             FROM DatasetAnnotation da
             JOIN User u ON da.user_id = u.user_id
             WHERE da.annotation_id = ?`,
            [annotationId]
        );
        
        if (annotation.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Annotation not found'
            });
        }
        
        const isOwner = annotation[0].user_id === req.session.userId;
        const isAdmin = annotation[0].role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized to delete this annotation'
            });
        }
        
        await connection.execute('DELETE FROM DatasetAnnotation WHERE annotation_id = ?', [annotationId]);
        
        await connection.commit();
        
        res.json({
            success: true,
            message: 'Annotation deleted successfully'
        });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting annotation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete annotation'
        });
    } finally {
        if (connection) connection.release();
    }
});

// Get a student's assigned task (what they need to annotate)

app.get('/api/student/task', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'student') {
            return res.status(403).json({ success: false, error: 'Student access only' });
        }

        // Find existing assignment
        const [assignments] = await db.execute(`
            SELECT 
                sca.*,
                dct.column_name,
                dct.description as task_description,
                d.title as dataset_title,
                d.description as dataset_description,
                d.file_name,
                d.max_annotation
            FROM StudentCellAssignment sca
            JOIN DatasetColumnTask dct ON sca.task_id = dct.task_id
            JOIN Dataset d ON sca.dataset_id = d.dataset_id
            WHERE sca.student_id = ? AND sca.status = 'pending'
            LIMIT 1
        `, [req.session.userId]);

        if (assignments.length > 0) {
            const assignment = assignments[0];
            const rowData = await getRowFromCSV(assignment.file_name, assignment.row_index);
            
            // Get current count for limit info
            const currentCount = await getStudentDatasetCount(req.session.userId, assignment.dataset_id);
            const maxAllowed = assignment.max_annotation || 5;
            
            return res.json({
                success: true,
                hasAssignment: true,
                assignment: {
                    id: assignment.assignment_id,
                    datasetId: assignment.dataset_id,
                    datasetTitle: assignment.dataset_title,
                    datasetDescription: assignment.dataset_description,
                    columnName: assignment.column_name,
                    taskDescription: assignment.task_description,
                    rowIndex: assignment.row_index,
                    rowData: rowData,
                    currentValue: assignment.original_value,
                    limitInfo: {
                        remaining: maxAllowed - currentCount,
                        totalUsed: currentCount,
                        maxAllowed: maxAllowed
                    }
                }
            });
        }

        // Create new random assignment from any dataset
        const newAssignment = await assignStudentToNextEmptyCell(req.session.userId);
        
        if (newAssignment) {
            // Get limit info for the new assignment
            const currentCount = await getStudentDatasetCount(req.session.userId, newAssignment.datasetId);
            const maxAllowed = newAssignment.max_annotation || 5;
            
            res.json({
                success: true,
                hasAssignment: true,
                assignment: {
                    ...newAssignment,
                    limitInfo: {
                        remaining: maxAllowed - currentCount,
                        totalUsed: currentCount,
                        maxAllowed: maxAllowed
                    }
                }
            });
        } else {
            res.json({
                success: true,
                hasAssignment: false,
                message: 'No pending tasks available. All rows may be complete!'
            });
        }

    } catch (error) {
        console.error('Error getting student task:', error);
        res.status(500).json({ success: false, error: 'Failed to get task' });
    }
});


// In server.js - Update the specific dataset task endpoint
// Get student task for specific dataset

app.get('/api/student/task/:datasetId', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        // Check if user is student
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'student') {
            return res.status(403).json({ success: false, error: 'Student access only' });
        }

        const datasetId = req.params.datasetId;

        // First, check for pending assignment for this specific dataset
        const [assignments] = await db.execute(`
            SELECT 
                sca.*,
                dct.column_name,
                dct.description as task_description,
                d.title as dataset_title,
                d.description as dataset_description,
                d.file_name,
                d.max_annotation
            FROM StudentCellAssignment sca
            JOIN DatasetColumnTask dct ON sca.task_id = dct.task_id
            JOIN Dataset d ON sca.dataset_id = d.dataset_id
            WHERE sca.student_id = ? 
            AND sca.status = 'pending'
            AND sca.dataset_id = ?
            LIMIT 1
        `, [req.session.userId, datasetId]);

        if (assignments.length > 0) {
            const assignment = assignments[0];
            const rowData = await getRowFromCSV(assignment.file_name, assignment.row_index);
            
            // Get current count for limit info
            const currentCount = await getStudentDatasetCount(req.session.userId, datasetId);
            const maxAllowed = assignment.max_annotation || 5;
            
            return res.json({
                success: true,
                hasAssignment: true,
                assignment: {
                    id: assignment.assignment_id,
                    datasetId: assignment.dataset_id,
                    datasetTitle: assignment.dataset_title,
                    datasetDescription: assignment.dataset_description,
                    columnName: assignment.column_name,
                    taskDescription: assignment.task_description,
                    rowIndex: assignment.row_index,
                    rowData: rowData,
                    currentValue: assignment.original_value,
                    limitInfo: {
                        remaining: maxAllowed - currentCount,
                        totalUsed: currentCount,
                        maxAllowed: maxAllowed
                    }
                }
            });
        }

        // No pending assignment for this dataset, try to create one for THIS dataset
        const result = await assignStudentToSpecificDataset(req.session.userId, datasetId);
        
        if (result.success && result.assignment) {
            res.json({
                success: true,
                hasAssignment: true,
                assignment: result.assignment
            });
        } else if (result.reason === 'limit_reached') {
            res.json({
                success: true,
                hasAssignment: false,
                limitReached: true,
                limitInfo: result.limitInfo,
                message: `You've reached your annotation limit (${result.limitInfo.currentCount}/${result.limitInfo.maxAllowed}) for this dataset. Great work!`
            });
        } else {
            // Check if there's a task for this dataset at all
            const [tasks] = await db.execute(`
                SELECT * FROM DatasetColumnTask 
                WHERE dataset_id = ? AND is_active = TRUE
            `, [datasetId]);
            
            if (tasks.length === 0) {
                res.json({
                    success: true,
                    hasAssignment: false,
                    message: 'No annotation tasks available for this dataset yet. Check back later!'
                });
            } else {
                res.json({
                    success: true,
                    hasAssignment: false,
                    message: 'All tasks for this dataset are complete! Great job!'
                });
            }
        }

    } catch (error) {
        console.error('Error getting student task:', error);
        res.status(500).json({ success: false, error: 'Failed to get task' });
    }
});



async function assignStudentToSpecificDataset(studentId, datasetId) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Check if student has reached their limit for this dataset
        const limitCheck = await checkStudentDatasetLimit(studentId, datasetId);
        
        if (!limitCheck.canAnnotate) {
            console.log(`Student ${studentId} has reached limit (${limitCheck.currentCount}/${limitCheck.maxAllowed}) for dataset ${datasetId}`);
            return { 
                success: false, 
                reason: 'limit_reached',
                limitInfo: limitCheck 
            };
        }

        // Find active tasks for this specific dataset
        const [tasks] = await connection.execute(`
            SELECT dct.*, d.file_name, d.title, d.description
            FROM DatasetColumnTask dct
            JOIN Dataset d ON dct.dataset_id = d.dataset_id
            WHERE dct.dataset_id = ? AND dct.is_active = TRUE
            ORDER BY dct.created_at ASC
        `, [datasetId]);

        if (tasks.length === 0) return { success: false, reason: 'no_tasks' };

        // Get all available rows that need contributions
        const availableRows = [];
        
        for (const task of tasks) {
            // Count rows in CSV
            const rowCount = await getCSVRowCount(task.file_name);
            
            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
                // Check how many contributions this row already has
                const [contributions] = await connection.execute(`
                    SELECT COUNT(*) as count
                    FROM StudentCellAssignment
                    WHERE dataset_id = ? AND task_id = ? AND row_index = ?
                    AND status = 'submitted'
                `, [task.dataset_id, task.task_id, rowIndex]);

                if (contributions[0].count < task.min_contributions) {
                    // Check if student already assigned to this row
                    const [existing] = await connection.execute(`
                        SELECT * FROM StudentCellAssignment
                        WHERE dataset_id = ? AND task_id = ? AND row_index = ? AND student_id = ?
                    `, [task.dataset_id, task.task_id, rowIndex, studentId]);

                    if (existing.length === 0) {
                        availableRows.push({
                            task: task,
                            rowIndex: rowIndex
                        });
                    }
                }
            }
        }

        if (availableRows.length === 0) {
            await connection.commit();
            return { success: false, reason: 'no_available_rows' };
        }

        // Select a random row from available rows
        const randomIndex = Math.floor(Math.random() * availableRows.length);
        const selected = availableRows[randomIndex];
        const task = selected.task;
        const rowIndex = selected.rowIndex;

        // Get current value from CSV
        const rowData = await getRowFromCSV(task.file_name, rowIndex);
        const currentValue = rowData[task.column_name] || '';
        
        // Create assignment
        const [result] = await connection.execute(`
            INSERT INTO StudentCellAssignment 
            (dataset_id, task_id, student_id, row_index, original_value)
            VALUES (?, ?, ?, ?, ?)
        `, [task.dataset_id, task.task_id, studentId, rowIndex, currentValue]);
        
        await connection.commit();
        
        // Fetch the complete assignment data
        const [newAssignment] = await connection.execute(`
            SELECT 
                sca.*,
                dct.column_name,
                dct.description as task_description,
                d.title as dataset_title,
                d.description as dataset_description,
                d.file_name,
                d.max_annotation
            FROM StudentCellAssignment sca
            JOIN DatasetColumnTask dct ON sca.task_id = dct.task_id
            JOIN Dataset d ON sca.dataset_id = d.dataset_id
            WHERE sca.assignment_id = ?
        `, [result.insertId]);

        return {
            success: true,
            assignment: {
                id: newAssignment[0].assignment_id,
                datasetId: newAssignment[0].dataset_id,
                datasetTitle: newAssignment[0].dataset_title,
                datasetDescription: newAssignment[0].dataset_description,
                columnName: newAssignment[0].column_name,
                taskDescription: newAssignment[0].task_description,
                rowIndex: newAssignment[0].row_index,
                rowData: rowData,
                currentValue: currentValue,
                limitInfo: {
                    remaining: limitCheck.remaining - 1,
                    totalUsed: limitCheck.currentCount + 1,
                    maxAllowed: limitCheck.maxAllowed
                }
            }
        };
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Helper function to assign student to next empty cell
async function assignStudentToNextEmptyCell(studentId, specificDatasetId = null) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Find active tasks - either for specific dataset or any
        let taskQuery = `
            SELECT dct.*, d.file_name, d.title, d.description, d.max_annotation
            FROM DatasetColumnTask dct
            JOIN Dataset d ON dct.dataset_id = d.dataset_id
            WHERE dct.is_active = TRUE
        `;
        
        const queryParams = [];
        
        if (specificDatasetId) {
            taskQuery += ` AND dct.dataset_id = ?`;
            queryParams.push(specificDatasetId);
        }
        
        taskQuery += ` ORDER BY dct.created_at ASC`;
        
        const [tasks] = await connection.execute(taskQuery, queryParams);

        if (tasks.length === 0) return null;

        // Collect all available rows across all tasks
        const availableRows = [];
        
        for (const task of tasks) {
            // Check if student has reached limit for this dataset
            const limitCheck = await checkStudentDatasetLimit(studentId, task.dataset_id);
            if (!limitCheck.canAnnotate) continue;
            
            // Count rows in CSV
            const rowCount = await getCSVRowCount(task.file_name);
            
            for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
                // Check how many contributions this row already has
                const [contributions] = await connection.execute(`
                    SELECT COUNT(*) as count
                    FROM StudentCellAssignment
                    WHERE dataset_id = ? AND task_id = ? AND row_index = ?
                    AND status = 'submitted'
                `, [task.dataset_id, task.task_id, rowIndex]);

                if (contributions[0].count < task.min_contributions) {
                    // Check if student already assigned to this row
                    const [existing] = await connection.execute(`
                        SELECT * FROM StudentCellAssignment
                        WHERE dataset_id = ? AND task_id = ? AND row_index = ? AND student_id = ?
                    `, [task.dataset_id, task.task_id, rowIndex, studentId]);

                    if (existing.length === 0) {
                        availableRows.push({
                            task: task,
                            rowIndex: rowIndex
                        });
                    }
                }
            }
        }

        if (availableRows.length === 0) {
            await connection.commit();
            return null;
        }

        // Select a random row from available rows
        const randomIndex = Math.floor(Math.random() * availableRows.length);
        const selected = availableRows[randomIndex];
        const task = selected.task;
        const rowIndex = selected.rowIndex;

        // Get current value from CSV
        const rowData = await getRowFromCSV(task.file_name, rowIndex);
        const currentValue = rowData[task.column_name] || '';
        
        // Create assignment
        const [result] = await connection.execute(`
            INSERT INTO StudentCellAssignment 
            (dataset_id, task_id, student_id, row_index, original_value)
            VALUES (?, ?, ?, ?, ?)
        `, [task.dataset_id, task.task_id, studentId, rowIndex, currentValue]);
        
        await connection.commit();
        
        // Fetch the complete assignment data
        const [newAssignment] = await connection.execute(`
            SELECT 
                sca.*,
                dct.column_name,
                dct.description as task_description,
                d.title as dataset_title,
                d.description as dataset_description,
                d.file_name,
                d.max_annotation
            FROM StudentCellAssignment sca
            JOIN DatasetColumnTask dct ON sca.task_id = dct.task_id
            JOIN Dataset d ON sca.dataset_id = d.dataset_id
            WHERE sca.assignment_id = ?
        `, [result.insertId]);

        return {
            id: newAssignment[0].assignment_id,
            datasetId: newAssignment[0].dataset_id,
            datasetTitle: newAssignment[0].dataset_title,
            datasetDescription: newAssignment[0].dataset_description,
            columnName: newAssignment[0].column_name,
            taskDescription: newAssignment[0].task_description,
            rowIndex: newAssignment[0].row_index,
            rowData: rowData,
            currentValue: currentValue
        };
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Helper: Get row count from CSV
async function getCSVRowCount(fileName) {
    const filePath = path.join(__dirname, '../uploads/datasets', fileName);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    return lines.length - 1; // Subtract header
}

// Helper: Get specific row from CSV
async function getRowFromCSV(fileName, rowIndex) {
    const filePath = path.join(__dirname, '../uploads/datasets', fileName);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    
    if (rowIndex + 1 >= lines.length) return {};
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/["']/g, ''));
    const values = lines[rowIndex + 1].split(',').map(v => v.trim().replace(/["']/g, ''));
    
    const row = {};
    headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
    });
    
    return row;
}

// Add these helper functions to server.js

// Check if student has reached their limit for a specific dataset
async function checkStudentDatasetLimit(studentId, datasetId) {
    try {
        // Get the dataset's configured limit
        const [datasets] = await db.execute(
            'SELECT max_annotation FROM Dataset WHERE dataset_id = ?',
            [datasetId]
        );
        
        if (datasets.length === 0) {
            return { canAnnotate: false, error: 'Dataset not found' };
        }
        
        const maxAllowed = datasets[0].max_annotation || 5;
        
        // Get student's current annotation count for this dataset
        const [counts] = await db.execute(
            `SELECT annotation_count 
             FROM StudentLabelCount 
             WHERE dataset_id = ? AND student_id = ?`,
            [datasetId, studentId]
        );
        
        const currentCount = counts.length > 0 ? counts[0].annotation_count : 0;
        const remaining = maxAllowed - currentCount;
        
        return {
            canAnnotate: remaining > 0,
            currentCount: currentCount,
            maxAllowed: maxAllowed,
            remaining: remaining
        };
    } catch (error) {
        console.error('Error checking student dataset limit:', error);
        return { canAnnotate: false, currentCount: 0, maxAllowed: 0, remaining: 0, error: error.message };
    }
}

// Increment student's annotation count for a dataset
async function incrementStudentDatasetCount(studentId, datasetId) {
    try {
        const [result] = await db.execute(
            `INSERT INTO StudentLabelCount (dataset_id, student_id, annotation_count)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE 
             annotation_count = annotation_count + 1`,
            [datasetId, studentId]
        );
        
        return result;
    } catch (error) {
        console.error('Error incrementing student dataset count:', error);
        throw error;
    }
}

// Get student's annotation count for a dataset
async function getStudentDatasetCount(studentId, datasetId) {
    try {
        const [counts] = await db.execute(
            `SELECT annotation_count 
             FROM StudentLabelCount 
             WHERE dataset_id = ? AND student_id = ?`,
            [datasetId, studentId]
        );
        
        return counts.length > 0 ? counts[0].annotation_count : 0;
    } catch (error) {
        console.error('Error getting student dataset count:', error);
        return 0;
    }
}

// Submit student's annotation
// Update the submission endpoint
app.post('/api/student/submit', async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const { assignmentId, submittedValue } = req.body;
        
        if (!submittedValue || submittedValue.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Please provide a value' });
        }
        
        await connection.beginTransaction();
        
        // Get assignment details
        const [assignments] = await connection.execute(`
            SELECT sca.*, dct.min_contributions, d.file_name, dct.column_name, dct.task_id, d.max_annotation
            FROM StudentCellAssignment sca
            JOIN DatasetColumnTask dct ON sca.task_id = dct.task_id
            JOIN Dataset d ON sca.dataset_id = d.dataset_id
            WHERE sca.assignment_id = ? AND sca.student_id = ?
        `, [assignmentId, req.session.userId]);
        
        if (assignments.length === 0) {
            return res.status(404).json({ success: false, error: 'Assignment not found' });
        }
        
        const assignment = assignments[0];
        
        // Update assignment
        await connection.execute(`
            UPDATE StudentCellAssignment 
            SET submitted_value = ?, status = 'submitted', submitted_at = NOW()
            WHERE assignment_id = ?
        `, [submittedValue, assignmentId]);
        
        // Increment student's annotation count for this dataset
        await incrementStudentDatasetCount(req.session.userId, assignment.dataset_id);
        
        // Get updated count
        const currentCount = await getStudentDatasetCount(req.session.userId, assignment.dataset_id);
        const maxAllowed = assignment.max_annotation || 5;
        
        // Check if this row now has enough contributions
        const [contributions] = await connection.execute(`
            SELECT submitted_value, COUNT(*) as count
            FROM StudentCellAssignment
            WHERE dataset_id = ? AND task_id = ? AND row_index = ? AND status = 'submitted'
            GROUP BY submitted_value
        `, [assignment.dataset_id, assignment.task_id, assignment.row_index]);
        
        if (contributions.length >= assignment.min_contributions) {
            // Calculate consensus (simple majority for now)
            const valueCounts = {};
            contributions.forEach(c => {
                valueCounts[c.submitted_value] = (valueCounts[c.submitted_value] || 0) + 1;
            });
            
            let consensusValue = null;
            let maxCount = 0;
            for (const [value, count] of Object.entries(valueCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    consensusValue = value;
                }
            }
            
            // Update CSV file
            const filePath = path.join(__dirname, '../uploads/datasets', assignment.file_name);
            let fileContent = await fs.readFile(filePath, 'utf-8');
            const lines = fileContent.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().replace(/["']/g, ''));
            
            // Find column index
            const columnIndex = headers.findIndex(h => h === assignment.column_name);
            
            if (columnIndex !== -1) {
                const rowValues = lines[assignment.row_index + 1].split(',');
                rowValues[columnIndex] = `"${consensusValue}"`; // Quote the value
                lines[assignment.row_index + 1] = rowValues.join(',');
                
                await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
                
                // Mark as resolved
                await connection.execute(`
                    INSERT INTO CellConsensus 
                    (dataset_id, task_id, row_index, consensus_value, contribution_count, is_resolved, resolved_at)
                    VALUES (?, ?, ?, ?, ?, TRUE, NOW())
                    ON DUPLICATE KEY UPDATE
                    consensus_value = VALUES(consensus_value),
                    is_resolved = TRUE,
                    resolved_at = NOW()
                `, [assignment.dataset_id, assignment.task_id, assignment.row_index, consensusValue, contributions.length]);
            }
        }
        
        await connection.commit();
        
        // Check if student still has remaining annotations for this dataset
        let nextAssignment = null;
        if (currentCount < maxAllowed) {
            // Try to assign next task for the same dataset
            const result = await assignStudentToSpecificDataset(req.session.userId, assignment.dataset_id);
            if (result.success) {
                nextAssignment = result.assignment;
            }
        }

        res.json({
            success: true,
            message: 'Annotation submitted successfully!',
            nextAssignment: nextAssignment || null,
            limitInfo: {
                remaining: maxAllowed - currentCount,
                totalUsed: currentCount,
                maxAllowed: maxAllowed
            }
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Error submitting annotation:', error);
        res.status(500).json({ success: false, error: 'Failed to submit annotation' });
    } finally {
        connection.release();
    }
});

// Admin endpoint to create a new column task
app.post('/api/admin/dataset/:id/column-task', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        // Check admin role
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const datasetId = req.params.id;
        const { columnName, description, minContributions = 3 } = req.body;
        
        if (!columnName) {
            return res.status(400).json({ success: false, error: 'Column name is required' });
        }
        
        // Verify column exists in the dataset
        const [datasets] = await db.execute('SELECT columns FROM Dataset WHERE dataset_id = ?', [datasetId]);
        if (datasets.length === 0) {
            return res.status(404).json({ success: false, error: 'Dataset not found' });
        }
        
        const columns = datasets[0].columns ? datasets[0].columns.split(',') : [];
        if (!columns.includes(columnName)) {
            return res.status(400).json({ success: false, error: 'Column not found in dataset' });
        }
        
        // Create task
        const [result] = await db.execute(`
            INSERT INTO DatasetColumnTask (dataset_id, column_name, description, min_contributions)
            VALUES (?, ?, ?, ?)
        `, [datasetId, columnName, description || `Help fill in missing data for ${columnName}`, minContributions]);
        
        res.json({
            success: true,
            message: 'Column task created successfully',
            taskId: result.insertId
        });
        
    } catch (error) {
        console.error('Error creating column task:', error);
        res.status(500).json({ success: false, error: 'Failed to create task' });
    }
});

// Admin endpoint to update a dataset's max annotations per student
app.put('/api/admin/dataset/:id/limit', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        // Check admin role
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const datasetId = req.params.id;
        const { maxAnnotationsPerStudent } = req.body;
        
        if (!maxAnnotationsPerStudent || maxAnnotationsPerStudent < 1) {
            return res.status(400).json({ success: false, error: 'Valid max annotations value is required (minimum 1)' });
        }
        
        if (maxAnnotationsPerStudent > 100) {
            return res.status(400).json({ success: false, error: 'Max annotations cannot exceed 100' });
        }
        
        await db.execute(
            'UPDATE Dataset SET max_annotation = ? WHERE dataset_id = ?',
            [maxAnnotationsPerStudent, datasetId]
        );
        
        res.json({
            success: true,
            message: `Dataset annotation limit updated to ${maxAnnotationsPerStudent} per student`
        });
        
    } catch (error) {
        console.error('Error updating dataset limit:', error);
        res.status(500).json({ success: false, error: 'Failed to update dataset limit' });
    }
});

// Admin endpoint to get dataset limits and student progress
app.get('/api/admin/dataset/:id/student-progress', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        // Check admin role
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const datasetId = req.params.id;
        
        // Get dataset info
        const [datasets] = await db.execute(
            'SELECT title, max_annotation FROM Dataset WHERE dataset_id = ?',
            [datasetId]
        );
        
        if (datasets.length === 0) {
            return res.status(404).json({ success: false, error: 'Dataset not found' });
        }
        
        // Get all student progress for this dataset
        const [progress] = await db.execute(`
            SELECT 
                u.user_id,
                u.name as student_name,
                u.email,
                COALESCE(sdac.annotation_count, 0) as annotations_made,
                d.max_annotation as max_allowed
            FROM User u
            CROSS JOIN Dataset d
            LEFT JOIN StudentLabelCount sdac 
                ON sdac.student_id = u.user_id 
                AND sdac.dataset_id = d.dataset_id
            WHERE u.role = 'student' AND d.dataset_id = ?
            ORDER BY u.name
        `, [datasetId]);
        
        res.json({
            success: true,
            dataset: datasets[0],
            studentProgress: progress
        });
        
    } catch (error) {
        console.error('Error getting student progress:', error);
        res.status(500).json({ success: false, error: 'Failed to get student progress' });
    }
});



app.post('/api/admin/dataset/:id/labels', async (req, res) => {
    let connection;
    
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        
        const datasetId = req.params.id;
        const { labelColumns } = req.body;
        
        if (!labelColumns || !Array.isArray(labelColumns) || labelColumns.length === 0) {
            return res.status(400).json({ success: false, error: 'Label columns configuration required' });
        }
        
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        // Clear existing label columns for this dataset
        await connection.execute('DELETE FROM DatasetLabelColumn WHERE dataset_id = ?', [datasetId]);
        
        // Insert new label columns
        for (const label of labelColumns) {
            const columnName = label.columnName || null;
            const displayColumn = label.displayColumn || label.columnName || null;
            const description = label.description || null;
            const possibleValues = label.possibleValues || [];
            
            if (!columnName) {
                throw new Error('Column name is required for each label');
            }
            if (!displayColumn) {
                throw new Error('Display column is required for each label');
            }
            
            await connection.execute(
                `INSERT INTO DatasetLabelColumn (dataset_id, column_name, display_column, description, possible_values)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    datasetId, 
                    columnName, 
                    displayColumn,
                    description,
                    JSON.stringify(possibleValues)
                ]
            );
        }
        
        await connection.commit();
        
        res.json({
            success: true,
            message: `Configured ${labelColumns.length} label columns for dataset`
        });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error setting up label columns:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to configure label columns' });
    } finally {
        if (connection) connection.release();
    }
});

// Admin: Get label columns for a dataset (Updated with display_column)
app.get('/api/admin/dataset/:id/labels', async (req, res) => {
    try {
        const datasetId = req.params.id;
        
        const [labels] = await db.execute(`
            SELECT * FROM DatasetLabelColumn 
            WHERE dataset_id = ? AND is_active = TRUE
            ORDER BY label_column_id
        `, [datasetId]);
        
        const parsedLabels = labels.map(label => ({
            ...label,
            description: label.description || '',
            display_column: label.display_column || label.column_name, // Fallback
            possible_values: label.possible_values ? JSON.parse(label.possible_values) : []
        }));
        
        res.json({
            success: true,
            labels: parsedLabels
        });
        
    } catch (error) {
        console.error('Error fetching label columns:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch label columns' });
    }
});

// Helper: Create a new label assignment for a student
async function createLabelAssignment(studentId, specificDatasetId = null) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Check if student has reached any dataset limits
        let datasetLimitQuery = `
            SELECT d.dataset_id, d.max_annotation, 
                   COALESCE(slc.annotation_count, 0) as current_count
            FROM Dataset d
            LEFT JOIN StudentLabelCount slc ON d.dataset_id = slc.dataset_id AND slc.student_id = ?
            WHERE d.is_public = 1
            AND (slc.annotation_count IS NULL OR slc.annotation_count < d.max_annotation)
        `;
        
        const queryParams = [studentId];
        
        if (specificDatasetId) {
            datasetLimitQuery += ` AND d.dataset_id = ?`;
            queryParams.push(specificDatasetId);
        }
        
        datasetLimitQuery += ` ORDER BY slc.annotation_count ASC LIMIT 1`;
        
        const [datasetLimits] = await connection.execute(datasetLimitQuery, queryParams);
        
        if (datasetLimits.length === 0) {
            return null;
        }
        
        const datasetId = datasetLimits[0].dataset_id;
        
        // Get active label columns
        const [labelColumns] = await connection.execute(`
            SELECT dlc.*, d.file_name, d.title, d.description, d.max_annotation
            FROM DatasetLabelColumn dlc
            JOIN Dataset d ON dlc.dataset_id = d.dataset_id
            WHERE dlc.dataset_id = ? AND dlc.is_active = TRUE
        `, [datasetId]);
        
        if (labelColumns.length === 0) {
            return null;
        }
        
        // Get CSV file info
        const [dataset] = await connection.execute(
            'SELECT file_name, title, description, max_annotation FROM Dataset WHERE dataset_id = ?',
            [datasetId]
        );
        
        if (dataset.length === 0) return null;
        
        // Parse CSV to rows
        const filePath = path.join(__dirname, '../uploads/datasets', dataset[0].file_name);
        const rows = await parseCSVToRows(filePath);
        
        // Find rows that need annotations
        const availableRows = [];
        
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            for (const labelCol of labelColumns) {
                const [consensus] = await connection.execute(
                    'SELECT contribution_count, is_resolved FROM LabelConsensus WHERE dataset_id = ? AND label_column_id = ? AND row_index = ?',
                    [datasetId, labelCol.label_column_id, rowIndex]
                );
                
                const needsMoreContributions = consensus.length === 0 || 
                    (!consensus[0].is_resolved && consensus[0].contribution_count < 3);
                
                if (needsMoreContributions) {
                    const [existing] = await connection.execute(
                        'SELECT * FROM StudentLabelAssignment WHERE dataset_id = ? AND label_column_id = ? AND row_index = ? AND student_id = ?',
                        [datasetId, labelCol.label_column_id, rowIndex, studentId]
                    );
                    
                    if (existing.length === 0) {
                        const rowData = rows[rowIndex];
                        const displayColumn = labelCol.display_column || labelCol.column_name;
                        
                        const filteredRowData = {};
                        
                        if (rowData[displayColumn] !== undefined && rowData[displayColumn] !== '') {
                            filteredRowData[displayColumn] = rowData[displayColumn];
                        } else {
                            const firstCol = Object.keys(rowData)[0];
                            if (firstCol) {
                                filteredRowData[firstCol] = rowData[firstCol] || 'No data';
                            } else {
                                filteredRowData['value'] = 'No data available';
                            }
                        }
                        
                        if (rowData[labelCol.column_name] !== undefined) {
                            filteredRowData['current_' + labelCol.column_name] = rowData[labelCol.column_name];
                        }
                        
                        availableRows.push({
                            labelColumn: labelCol,
                            rowIndex: rowIndex,
                            rowData: filteredRowData,
                            displayColumn: displayColumn,
                            originalRowData: rowData
                        });
                    }
                }
            }
        }
        
        if (availableRows.length === 0) {
            await connection.commit();
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * availableRows.length);
        const selected = availableRows[randomIndex];
        
        const [result] = await connection.execute(`
            INSERT INTO StudentLabelAssignment 
            (dataset_id, label_column_id, student_id, row_index, row_data)
            VALUES (?, ?, ?, ?, ?)
        `, [datasetId, selected.labelColumn.label_column_id, studentId, selected.rowIndex, JSON.stringify(selected.rowData)]);
        
        await connection.commit();
        
        // Return the assignment WITHOUT limitInfo - it will be added by the caller
        return {
            id: result.insertId,
            datasetId: datasetId,
            datasetTitle: dataset[0].title,
            datasetDescription: dataset[0].description,
            columnName: selected.labelColumn.column_name,
            displayColumn: selected.displayColumn,
            labelDescription: selected.labelColumn.description || `Please label the ${selected.labelColumn.column_name} column`,
            rowIndex: selected.rowIndex,
            rowData: selected.rowData,
            possibleValues: JSON.parse(selected.labelColumn.possible_values || '[]')
        };
        
    } catch (error) {
        await connection.rollback();
        console.error('Error in createLabelAssignment:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Student: Get next annotation task (with clickable options)


app.get('/api/student/annotation-task', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'student') {
            return res.status(403).json({ success: false, error: 'Student access only' });
        }
        
        const studentId = req.session.userId;
        const specificDatasetId = req.query.dataset;
        
        const connection = await db.getConnection();
        
        try {
            let assignmentQuery = `
                SELECT 
                    sla.*,
                    dlc.column_name,
                    dlc.display_column,
                    dlc.description as label_description,
                    dlc.possible_values,
                    d.title as dataset_title,
                    d.description as dataset_description,
                    d.file_name,
                    d.max_annotation
                FROM StudentLabelAssignment sla
                JOIN DatasetLabelColumn dlc ON sla.label_column_id = dlc.label_column_id
                JOIN Dataset d ON sla.dataset_id = d.dataset_id
                WHERE sla.student_id = ? AND sla.status = 'pending'
            `;
            
            const queryParams = [studentId];
            
            if (specificDatasetId) {
                assignmentQuery += ` AND sla.dataset_id = ?`;
                queryParams.push(specificDatasetId);
            }
            
            assignmentQuery += ` LIMIT 1`;
            
            const [assignments] = await connection.execute(assignmentQuery, queryParams);
            
            if (assignments.length > 0) {
                const assignment = assignments[0];
                const rowData = JSON.parse(assignment.row_data || '{}');
                const possibleValues = JSON.parse(assignment.possible_values || '[]');
                
                // Get current count for limit info
                const [counts] = await connection.execute(
                    `SELECT annotation_count FROM StudentLabelCount 
                     WHERE dataset_id = ? AND student_id = ?`,
                    [assignment.dataset_id, studentId]
                );
                const currentCount = counts.length > 0 ? counts[0].annotation_count : 0;
                const maxAllowed = assignment.max_annotation || 5;
                
                connection.release();
                
                return res.json({
                    success: true,
                    hasAssignment: true,
                    assignment: {
                        id: assignment.assignment_id,
                        datasetId: assignment.dataset_id,
                        datasetTitle: assignment.dataset_title,
                        datasetDescription: assignment.dataset_description,
                        columnName: assignment.column_name,
                        displayColumn: assignment.display_column || assignment.column_name,
                        labelDescription: assignment.label_description,
                        rowIndex: assignment.row_index,
                        rowData: rowData,
                        possibleValues: possibleValues,
                        limitInfo: {
                            remaining: maxAllowed - currentCount,
                            totalUsed: currentCount,
                            maxAllowed: maxAllowed
                        }
                    }
                });
            }
            
            // No pending assignment - create a new one
            const newAssignment = await createLabelAssignment(studentId, specificDatasetId);
            
            connection.release();
            
            if (newAssignment) {
                // Get the current count for limit info
                const [counts] = await db.execute(
                    `SELECT annotation_count FROM StudentLabelCount 
                     WHERE dataset_id = ? AND student_id = ?`,
                    [newAssignment.datasetId, studentId]
                );
                const currentCount = counts.length > 0 ? counts[0].annotation_count : 0;
                const maxAllowed = newAssignment.max_annotation || 5;
                
                // Add limitInfo to the new assignment
                newAssignment.limitInfo = {
                    remaining: maxAllowed - currentCount,
                    totalUsed: currentCount,
                    maxAllowed: maxAllowed
                };
                
                res.json({
                    success: true,
                    hasAssignment: true,
                    assignment: newAssignment
                });
            } else {
                res.json({
                    success: true,
                    hasAssignment: false,
                    message: 'No pending annotation tasks available!'
                });
            }
            
        } catch (error) {
            connection.release();
            throw error;
        }
        
    } catch (error) {
        console.error('Error getting annotation task:', error);
        res.status(500).json({ success: false, error: 'Failed to get task' });
    }
});

// In server.js - Update createLabelAssignment to properly use display_column

async function createLabelAssignment(studentId, specificDatasetId = null) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Check if student has reached any dataset limits (or specific dataset)
        let datasetLimitQuery = `
            SELECT d.dataset_id, d.max_annotation, 
                   COALESCE(slc.annotation_count, 0) as current_count
            FROM Dataset d
            LEFT JOIN StudentLabelCount slc ON d.dataset_id = slc.dataset_id AND slc.student_id = ?
            WHERE d.is_public = 1
            AND (slc.annotation_count IS NULL OR slc.annotation_count < d.max_annotation)
        `;
        
        const queryParams = [studentId];
        
        if (specificDatasetId) {
            datasetLimitQuery += ` AND d.dataset_id = ?`;
            queryParams.push(specificDatasetId);
        }
        
        datasetLimitQuery += ` ORDER BY slc.annotation_count ASC LIMIT 1`;
        
        const [datasetLimits] = await connection.execute(datasetLimitQuery, queryParams);
        
        if (datasetLimits.length === 0) {
            return null;
        }
        
        const datasetId = datasetLimits[0].dataset_id;
        
        // Get active label columns for this dataset - INCLUDE display_column
        const [labelColumns] = await connection.execute(`
            SELECT dlc.*, d.file_name, d.title, d.description, d.max_annotation
            FROM DatasetLabelColumn dlc
            JOIN Dataset d ON dlc.dataset_id = d.dataset_id
            WHERE dlc.dataset_id = ? AND dlc.is_active = TRUE
        `, [datasetId]);
        
        console.log('Label columns fetched:', labelColumns.map(lc => ({
            column_name: lc.column_name,
            display_column: lc.display_column
        })));
        
        if (labelColumns.length === 0) {
            return null;
        }
        
        // Get CSV file info
        const [dataset] = await connection.execute(
            'SELECT file_name, title, description, max_annotation FROM Dataset WHERE dataset_id = ?',
            [datasetId]
        );
        
        if (dataset.length === 0) return null;
        
        // Parse CSV to rows
        const filePath = path.join(__dirname, '../uploads/datasets', dataset[0].file_name);
        const rows = await parseCSVToRows(filePath);
        console.log(`Parsed ${rows.length} rows from CSV`);
        
        // Find rows that need annotations for any label column
        const availableRows = [];
        
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            for (const labelCol of labelColumns) {
                // Check if this row already has enough consensus for this label
                const [consensus] = await connection.execute(
                    'SELECT contribution_count, is_resolved FROM LabelConsensus WHERE dataset_id = ? AND label_column_id = ? AND row_index = ?',
                    [datasetId, labelCol.label_column_id, rowIndex]
                );
                
                const needsMoreContributions = consensus.length === 0 || 
                    (!consensus[0].is_resolved && consensus[0].contribution_count < 3);
                
                if (needsMoreContributions) {
                    // Check if student already assigned to this cell
                    const [existing] = await connection.execute(
                        'SELECT * FROM StudentLabelAssignment WHERE dataset_id = ? AND label_column_id = ? AND row_index = ? AND student_id = ?',
                        [datasetId, labelCol.label_column_id, rowIndex, studentId]
                    );
                    
                    if (existing.length === 0) {
                        const rowData = rows[rowIndex];
                        // Get the display column from the label config, fallback to column_name
                        const displayColumn = labelCol.display_column || labelCol.column_name;
                        
                        console.log(`Row ${rowIndex}, displayColumn: ${displayColumn}, value:`, rowData[displayColumn]);
                        
                        // Build filtered row data - ONLY include the display column and label column
                        const filteredRowData = {};
                        
                        // Add the display column value
                        if (rowData[displayColumn] !== undefined && rowData[displayColumn] !== '') {
                            filteredRowData[displayColumn] = rowData[displayColumn];
                            console.log(`Added display column '${displayColumn}' with value:`, rowData[displayColumn]);
                        } else {
                            // If display column has no value, use a fallback
                            const firstCol = Object.keys(rowData)[0];
                            if (firstCol) {
                                filteredRowData[firstCol] = rowData[firstCol] || 'No data';
                            } else {
                                filteredRowData['value'] = 'No data available';
                            }
                        }
                        
                        // Add the current value of the label column for context
                        if (rowData[labelCol.column_name] !== undefined) {
                            filteredRowData['current_' + labelCol.column_name] = rowData[labelCol.column_name];
                        }
                        
                        availableRows.push({
                            labelColumn: labelCol,
                            rowIndex: rowIndex,
                            rowData: filteredRowData,
                            displayColumn: displayColumn,
                            originalRowData: rowData
                        });
                    }
                }
            }
        }
        
        console.log(`Found ${availableRows.length} available rows`);
        
        if (availableRows.length === 0) {
            await connection.commit();
            return null;
        }
        
        // Select random row
        const randomIndex = Math.floor(Math.random() * availableRows.length);
        const selected = availableRows[randomIndex];
        
        console.log('Selected displayColumn:', selected.displayColumn);
        console.log('Selected rowData:', selected.rowData);
        
        // Create assignment
        const [result] = await connection.execute(`
            INSERT INTO StudentLabelAssignment 
            (dataset_id, label_column_id, student_id, row_index, row_data)
            VALUES (?, ?, ?, ?, ?)
        `, [datasetId, selected.labelColumn.label_column_id, studentId, selected.rowIndex, JSON.stringify(selected.rowData)]);
        
        // Get the updated count for limit info
        const [counts] = await connection.execute(
            `SELECT annotation_count FROM StudentLabelCount 
             WHERE dataset_id = ? AND student_id = ?`,
            [datasetId, studentId]
        );
        const currentCount = counts.length > 0 ? counts[0].annotation_count : 0;
        const maxAllowed = dataset[0].max_annotation || 5;
        
        await connection.commit();
        
        const assignmentResult = {
            id: result.insertId,
            datasetId: datasetId,
            datasetTitle: dataset[0].title,
            datasetDescription: dataset[0].description,
            columnName: selected.labelColumn.column_name,
            displayColumn: selected.displayColumn, // IMPORTANT: Include this
            labelDescription: selected.labelColumn.description || `Please label the ${selected.labelColumn.column_name} column`,
            rowIndex: selected.rowIndex,
            rowData: selected.rowData,
            possibleValues: JSON.parse(selected.labelColumn.possible_values || '[]'),
            limitInfo: {
                remaining: maxAllowed - (currentCount + 1),
                totalUsed: currentCount + 1,
                maxAllowed: maxAllowed
            }
        };
        
        console.log('Returning assignment with displayColumn:', assignmentResult.displayColumn);
        console.log('RowData keys:', Object.keys(assignmentResult.rowData));
        
        return assignmentResult;
        
    } catch (error) {
        await connection.rollback();
        console.error('Error in createLabelAssignment:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Helper: Parse CSV to rows
async function parseCSVToRows(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/["']/g, ''));
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim().replace(/["']/g, ''));
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
        });
        rows.push(row);
    }
    
    return rows;
}

app.get('/api/dataset/:datasetId/available-labels', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'student') {
            return res.status(403).json({ success: false, error: 'Student access only' });
        }
        
        const datasetId = req.params.datasetId;
        const studentId = req.session.userId;
        
        // Get all active label columns for this dataset
        const [labelColumns] = await db.execute(`
            SELECT * FROM DatasetLabelColumn 
            WHERE dataset_id = ? AND is_active = TRUE
        `, [datasetId]);
        
        if (labelColumns.length === 0) {
            return res.json({ success: true, availableLabels: [] });
        }
        
        // For each label column, check if there are pending rows that need annotations
        const availableLabels = [];
        
        for (const labelCol of labelColumns) {
            // Get CSV file info
            const [dataset] = await db.execute(
                'SELECT file_name, max_annotation FROM Dataset WHERE dataset_id = ?',
                [datasetId]
            );
            
            if (dataset.length === 0) continue;
            
            // Parse CSV to get row count
            const filePath = path.join(__dirname, '../uploads/datasets', dataset[0].file_name);
            const rows = await parseCSVToRows(filePath);
            
            let pendingCount = 0;
            let hasUnfinishedAssignment = false;
            
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                // Check if student already has a pending assignment for this row/label
                const [existingAssignment] = await db.execute(`
                    SELECT * FROM StudentLabelAssignment 
                    WHERE dataset_id = ? AND label_column_id = ? AND row_index = ? AND student_id = ? AND status = 'pending'
                `, [datasetId, labelCol.label_column_id, rowIndex, studentId]);
                
                if (existingAssignment.length > 0) {
                    hasUnfinishedAssignment = true;
                    pendingCount++;
                    continue;
                }
                
                // Check if this row needs more contributions for this label
                const [consensus] = await db.execute(`
                    SELECT contribution_count, is_resolved FROM LabelConsensus 
                    WHERE dataset_id = ? AND label_column_id = ? AND row_index = ?
                `, [datasetId, labelCol.label_column_id, rowIndex]);
                
                const needsMoreContributions = consensus.length === 0 || 
                    (!consensus[0].is_resolved && consensus[0].contribution_count < 3);
                
                if (needsMoreContributions) {
                    pendingCount++;
                }
            }
            
            // Check student's limit for this dataset
            const limitCheck = await checkStudentDatasetLimit(studentId, datasetId);
            
            availableLabels.push({
                label_column_id: labelCol.label_column_id,
                column_name: labelCol.column_name,
                description: labelCol.description || '',
                possible_values: JSON.parse(labelCol.possible_values || '[]'),
                pending_count: pendingCount,
                has_unfinished_assignment: hasUnfinishedAssignment,
                can_annotate: limitCheck.canAnnotate,
                remaining_annotations: limitCheck.remaining
            });
        }
        
        res.json({
            success: true,
            availableLabels: availableLabels,
            datasetTitle: labelColumns.length > 0 ? (await db.execute('SELECT title FROM Dataset WHERE dataset_id = ?', [datasetId]))[0][0]?.title : null
        });
        
    } catch (error) {
        console.error('Error getting available labels:', error);
        res.status(500).json({ success: false, error: 'Failed to get available labels' });
    }
});

// Get or create assignment for a specific label column
app.post('/api/student/get-label-assignment', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        if (users[0]?.role !== 'student') {
            return res.status(403).json({ success: false, error: 'Student access only' });
        }
        
        const { datasetId, labelColumnId } = req.body;
        const studentId = req.session.userId;
        
        // Check if student has a pending assignment for this label column
        const [existingAssignments] = await db.execute(`
            SELECT 
                sla.*,
                dlc.column_name,
                dlc.display_column,
                dlc.description as label_description,
                dlc.possible_values,
                d.title as dataset_title,
                d.description as dataset_description,
                d.file_name,
                d.max_annotation
            FROM StudentLabelAssignment sla
            JOIN DatasetLabelColumn dlc ON sla.label_column_id = dlc.label_column_id
            JOIN Dataset d ON sla.dataset_id = d.dataset_id
            WHERE sla.student_id = ? AND sla.dataset_id = ? AND sla.label_column_id = ? AND sla.status = 'pending'
            LIMIT 1
        `, [studentId, datasetId, labelColumnId]);
        
        if (existingAssignments.length > 0) {
            const assignment = existingAssignments[0];
            const rowData = JSON.parse(assignment.row_data || '{}');
            const possibleValues = JSON.parse(assignment.possible_values || '[]');
            const displayColumn = assignment.display_column || assignment.column_name;
            
            // Get limit info
            const [counts] = await db.execute(
                'SELECT annotation_count FROM StudentLabelCount WHERE dataset_id = ? AND student_id = ?',
                [datasetId, studentId]
            );
            const currentCount = counts.length > 0 ? counts[0].annotation_count : 0;
            const maxAllowed = assignment.max_annotation || 5;
            
            console.log('Existing assignment displayColumn:', displayColumn);
            console.log('RowData:', rowData);
            
            return res.json({
                success: true,
                hasAssignment: true,
                assignment: {
                    id: assignment.assignment_id,
                    datasetId: assignment.dataset_id,
                    datasetTitle: assignment.dataset_title,
                    datasetDescription: assignment.dataset_description,
                    columnName: assignment.column_name,
                    displayColumn: displayColumn,
                    labelDescription: assignment.label_description,
                    rowIndex: assignment.row_index,
                    rowData: rowData,
                    possibleValues: possibleValues,
                    limitInfo: {
                        remaining: maxAllowed - currentCount,
                        totalUsed: currentCount,
                        maxAllowed: maxAllowed
                    }
                }
            });
        }
        
        // Create a new assignment for this label column
        const newAssignment = await createLabelAssignmentForColumn(studentId, datasetId, labelColumnId);
        
        if (newAssignment) {
            console.log('New assignment created with displayColumn:', newAssignment.displayColumn);
            res.json({
                success: true,
                hasAssignment: true,
                assignment: newAssignment
            });
        } else {
            res.json({
                success: true,
                hasAssignment: false,
                message: 'No pending rows available for this label column.'
            });
        }
        
    } catch (error) {
        console.error('Error getting label assignment:', error);
        res.status(500).json({ success: false, error: 'Failed to get assignment' });
    }
});

// Helper: Create assignment for a specific label column
// In server.js - Update createLabelAssignmentForColumn

async function createLabelAssignmentForColumn(studentId, datasetId, labelColumnId) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Check student's limit
        const limitCheck = await checkStudentDatasetLimit(studentId, datasetId);
        if (!limitCheck.canAnnotate) {
            return null;
        }
        
        // Get label column info - INCLUDE display_column
        const [labelColumns] = await connection.execute(`
            SELECT * FROM DatasetLabelColumn 
            WHERE label_column_id = ? AND is_active = TRUE
        `, [labelColumnId]);
        
        if (labelColumns.length === 0) return null;
        
        const labelCol = labelColumns[0];
        
        // Get CSV file info
        const [dataset] = await connection.execute(
            'SELECT file_name, title, description, max_annotation FROM Dataset WHERE dataset_id = ?',
            [datasetId]
        );
        
        if (dataset.length === 0) return null;
        
        // Parse CSV
        const filePath = path.join(__dirname, '../uploads/datasets', dataset[0].file_name);
        const rows = await parseCSVToRows(filePath);
        
        // Find rows that need annotations for this label column
        const availableRows = [];
        
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            // Check if this row already has enough consensus
            const [consensus] = await connection.execute(
                'SELECT contribution_count, is_resolved FROM LabelConsensus WHERE dataset_id = ? AND label_column_id = ? AND row_index = ?',
                [datasetId, labelColumnId, rowIndex]
            );
            
            const needsMoreContributions = consensus.length === 0 || 
                (!consensus[0].is_resolved && consensus[0].contribution_count < 3);
            
            if (needsMoreContributions) {
                // Check if student already assigned to this cell
                const [existing] = await connection.execute(
                    'SELECT * FROM StudentLabelAssignment WHERE dataset_id = ? AND label_column_id = ? AND row_index = ? AND student_id = ?',
                    [datasetId, labelColumnId, rowIndex, studentId]
                );
                
                if (existing.length === 0) {
                    const rowData = rows[rowIndex];
                    const displayColumn = labelCol.display_column || labelCol.column_name;
                    
                    // Build filtered row data - include display column
                    const filteredRowData = {};
                    
                    // Add the display column value
                    if (rowData[displayColumn] !== undefined && rowData[displayColumn] !== '') {
                        filteredRowData[displayColumn] = rowData[displayColumn];
                    } else {
                        const firstCol = Object.keys(rowData)[0];
                        if (firstCol) {
                            filteredRowData[firstCol] = rowData[firstCol] || 'No data';
                        } else {
                            filteredRowData['value'] = 'No data available';
                        }
                    }
                    
                    // Add the current value of the label column for context
                    if (rowData[labelCol.column_name] !== undefined) {
                        filteredRowData['current_' + labelCol.column_name] = rowData[labelCol.column_name];
                    }
                    
                    availableRows.push({
                        rowIndex: rowIndex,
                        rowData: filteredRowData,
                        displayColumn: displayColumn
                    });
                }
            }
        }
        
        if (availableRows.length === 0) {
            await connection.commit();
            return null;
        }
        
        // Select random row
        const randomIndex = Math.floor(Math.random() * availableRows.length);
        const selected = availableRows[randomIndex];
        
        // Create assignment
        const [result] = await connection.execute(`
            INSERT INTO StudentLabelAssignment 
            (dataset_id, label_column_id, student_id, row_index, row_data)
            VALUES (?, ?, ?, ?, ?)
        `, [datasetId, labelColumnId, studentId, selected.rowIndex, JSON.stringify(selected.rowData)]);
        
        // Get updated count for limit info
        const [counts] = await connection.execute(
            `SELECT annotation_count FROM StudentLabelCount 
             WHERE dataset_id = ? AND student_id = ?`,
            [datasetId, studentId]
        );
        const currentCount = counts.length > 0 ? counts[0].annotation_count : 0;
        const maxAllowed = dataset[0].max_annotation || 5;
        
        await connection.commit();
        
        
        return {
            id: result.insertId,
            datasetId: datasetId,
            datasetTitle: dataset[0].title,
            datasetDescription: dataset[0].description,
            columnName: labelCol.column_name,
            displayColumn: selected.displayColumn, 
            labelDescription: labelCol.description || `Please label the ${labelCol.column_name} column`,
            rowIndex: selected.rowIndex,
            rowData: selected.rowData,
            possibleValues: JSON.parse(labelCol.possible_values || '[]'),
            limitInfo: {
                remaining: maxAllowed - (currentCount + 1),
                totalUsed: currentCount + 1,
                maxAllowed: maxAllowed
            }
        };
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Student: Submit annotation (selected value)
app.post('/api/student/submit-annotation', async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const { assignmentId, selectedValue } = req.body;
        
        if (!selectedValue) {
            return res.status(400).json({ success: false, error: 'Please select a value' });
        }
        
        await connection.beginTransaction();
        
        // Get assignment details
        const [assignments] = await connection.execute(`
            SELECT sla.*, dlc.column_name, dlc.label_column_id, d.file_name, d.dataset_id, d.max_annotation
            FROM StudentLabelAssignment sla
            JOIN DatasetLabelColumn dlc ON sla.label_column_id = dlc.label_column_id
            JOIN Dataset d ON sla.dataset_id = d.dataset_id
            WHERE sla.assignment_id = ? AND sla.student_id = ?
        `, [assignmentId, req.session.userId]);
        
        if (assignments.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: 'Assignment not found' });
        }
        
        const assignment = assignments[0];
        
        // Update assignment
        await connection.execute(`
            UPDATE StudentLabelAssignment 
            SET selected_value = ?, status = 'submitted', submitted_at = NOW()
            WHERE assignment_id = ?
        `, [selectedValue, assignmentId]);
        
        // Update student's annotation count
        await connection.execute(`
            INSERT INTO StudentLabelCount (dataset_id, student_id, annotation_count)
            VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE annotation_count = annotation_count + 1
        `, [assignment.dataset_id, req.session.userId]);
        
        // Check if we have enough contributions for consensus
        const [contributions] = await connection.execute(`
            SELECT selected_value, COUNT(*) as count
            FROM StudentLabelAssignment
            WHERE dataset_id = ? AND label_column_id = ? AND row_index = ? AND status = 'submitted'
            GROUP BY selected_value
        `, [assignment.dataset_id, assignment.label_column_id, assignment.row_index]);
        
        const totalContributions = contributions.reduce((sum, c) => sum + c.count, 0);
        
        if (totalContributions >= 3) {
            let consensusValue = null;
            let maxCount = 0;
            for (const contrib of contributions) {
                if (contrib.count > maxCount) {
                    maxCount = contrib.count;
                    consensusValue = contrib.selected_value;
                }
            }
            
            const filePath = path.join(__dirname, '../uploads/datasets', assignment.file_name);
            let fileContent = await fs.readFile(filePath, 'utf-8');
            const lines = fileContent.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().replace(/["']/g, ''));
            
            const columnIndex = headers.findIndex(h => h === assignment.column_name);
            
            if (columnIndex !== -1) {
                const rowValues = lines[assignment.row_index + 1].split(',');
                rowValues[columnIndex] = `"${consensusValue}"`;
                lines[assignment.row_index + 1] = rowValues.join(',');
                await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
            }
            
            await connection.execute(`
                INSERT INTO LabelConsensus 
                (dataset_id, label_column_id, row_index, consensus_value, contribution_count, is_resolved, resolved_at)
                VALUES (?, ?, ?, ?, ?, TRUE, NOW())
                ON DUPLICATE KEY UPDATE
                consensus_value = VALUES(consensus_value),
                is_resolved = TRUE,
                resolved_at = NOW()
            `, [assignment.dataset_id, assignment.label_column_id, assignment.row_index, consensusValue, totalContributions]);
        }
        
        // Get updated count for limit info - THIS IS THE CURRENT COUNT AFTER INCREMENT
        const [counts] = await connection.execute(
            'SELECT annotation_count FROM StudentLabelCount WHERE dataset_id = ? AND student_id = ?',
            [assignment.dataset_id, req.session.userId]
        );
        const currentCount = counts.length > 0 ? counts[0].annotation_count : 0;
        const maxAllowed = assignment.max_annotation || 5;
        
        // Commit the transaction before getting next assignment
        await connection.commit();
        
        // Get next assignment WITHOUT incrementing the count again
        let nextAssignment = null;
        if (currentCount < maxAllowed) {
            const newAssignment = await createLabelAssignment(req.session.userId);
            if (newAssignment && newAssignment.datasetId === assignment.dataset_id) {
                // Use the SAME limitInfo - don't increment again
                newAssignment.limitInfo = {
                    remaining: maxAllowed - currentCount,
                    totalUsed: currentCount,
                    maxAllowed: maxAllowed
                };
                nextAssignment = newAssignment;
            }
        }
        
        // Return the response with the correct count
        res.json({
            success: true,
            message: 'Annotation submitted successfully!',
            nextAssignment: nextAssignment,
            limitInfo: {
                remaining: maxAllowed - currentCount,
                totalUsed: currentCount,
                maxAllowed: maxAllowed
            }
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Error submitting annotation:', error);
        res.status(500).json({ success: false, error: 'Failed to submit annotation' });
    } finally {
        connection.release();
    }
});

// Get all label annotations for a dataset (Admin view)
app.get('/api/datasets/:id/label-annotations', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const datasetId = req.params.id;
        
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        const isAdmin = users[0]?.role === 'admin';
        
        let query = `
            SELECT 
                sla.*,
                u.name as student_name,
                u.email as student_email,
                dlc.column_name,
                dlc.description as label_description
            FROM StudentLabelAssignment sla
            JOIN User u ON sla.student_id = u.user_id
            JOIN DatasetLabelColumn dlc ON sla.label_column_id = dlc.label_column_id
            WHERE sla.dataset_id = ?
        `;
        
        if (!isAdmin) {
            query += ` AND sla.student_id = ?`;
            const [annotations] = await db.execute(query, [datasetId, req.session.userId]);
            return res.json({ success: true, annotations, isAdmin: false });
        }
        
        const [annotations] = await db.execute(query, [datasetId]);
        res.json({ success: true, annotations, isAdmin: true });
        
    } catch (error) {
        console.error('Error fetching label annotations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch annotations' });
    }
});

// Get label consensus results
app.get('/api/datasets/:id/label-consensus', async (req, res) => {
    try {
        const datasetId = req.params.id;
        
        const [consensus] = await db.execute(`
            SELECT 
                lc.*,
                dlc.column_name
            FROM LabelConsensus lc
            JOIN DatasetLabelColumn dlc ON lc.label_column_id = dlc.label_column_id
            WHERE lc.dataset_id = ?
            ORDER BY lc.row_index ASC
        `, [datasetId]);
        
        res.json({ success: true, consensus });
        
    } catch (error) {
        console.error('Error fetching consensus:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch consensus' });
    }
});

// Get all annotations/submissions for a dataset (Admin view)
app.get('/api/datasets/:id/annotations/all', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        // Check if user is admin
        const [users] = await db.execute('SELECT role FROM User WHERE user_id = ?', [req.session.userId]);
        const isAdmin = users[0]?.role === 'admin';

        const datasetId = req.params.id;

        let query = `
            SELECT 
                sca.*,
                u.name as student_name,
                u.email as student_email,
                dct.column_name,
                dct.description as task_description
            FROM StudentCellAssignment sca
            JOIN User u ON sca.student_id = u.user_id
            JOIN DatasetColumnTask dct ON sca.task_id = dct.task_id
            WHERE sca.dataset_id = ?
        `;

        // If not admin, only show student's own submissions
        if (!isAdmin) {
            query += ` AND sca.student_id = ?`;
            const [annotations] = await db.execute(query, [datasetId, req.session.userId]);
            return res.json({ success: true, annotations, isAdmin: false });
        }

        const [annotations] = await db.execute(query, [datasetId]);
        res.json({ success: true, annotations, isAdmin: true });

    } catch (error) {
        console.error('Error fetching annotations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch annotations' });
    }
});

// Get consensus results for a dataset (what was actually written to CSV)
app.get('/api/datasets/:id/consensus', async (req, res) => {
    try {
        const datasetId = req.params.id;
        
        const [consensus] = await db.execute(`
            SELECT 
                cc.*,
                dct.column_name
            FROM CellConsensus cc
            JOIN DatasetColumnTask dct ON cc.task_id = dct.task_id
            WHERE cc.dataset_id = ?
            ORDER BY cc.row_index ASC
        `, [datasetId]);

        res.json({ success: true, consensus });

    } catch (error) {
        console.error('Error fetching consensus:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch consensus' });
    }
});

app.get('/api/leaderboard', async (req,res) => {
    try {
        const [leaderboard] = await db.execute(`
                SELECT sca.student_id, u.name, COUNT(*) annotation_count 
                FROM StudentLabelAssignment sca
                JOIN USER u ON sca.student_id = u.user_id
                WHERE sca.status = 'submitted'
                GROUP BY sca.student_id
                ORDER BY annotation_count DESC
            `)

            res.json({ success: true, leaderboard });

    } catch (error) {
        res.status(500).json({success: false, error: 'Failed calculating leaderboard'});
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK' });
});



app.post('/api/auth/google', async (req, res) => {
    const { token, email, name, picture } = req.body;

    // Log the request for debugging
    console.log('Received Google auth request:', { email, name });

    try {
        // Verify the token with Google to ensure it's valid
        const googleResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!googleResponse.ok) {
            console.error('Google token verification failed:', await googleResponse.text());
            return res.status(401).json({
                success: false,
                error: 'Invalid Google token'
            });
        }

        const googleUser = await googleResponse.json();
        console.log('Verified Google user:', googleUser.email);

        // Verify the email matches what was sent from frontend
        if (googleUser.email !== email) {
            return res.status(401).json({
                success: false,
                error: 'Email mismatch'
            });
        }

        // Check if user exists in database
        const [users] = await db.execute(
            'SELECT * FROM User WHERE email = ?',
            [email]
        );

        let user;

        if (users.length === 0) {
            // Create new user
            const [result] = await db.execute(
                'INSERT INTO User (email, name, picture) VALUES (?, ?, ?)',
                [email, name || googleUser.name, picture || googleUser.picture]
            );

            user = {
                id: result.insertId,
                email: email,
                name: name || googleUser.name,
                picture: picture || googleUser.picture
            };

            console.log('Created new user:', user.email);
        } else {
            // Update existing user
            user = users[0];

            // Update last login timestamp
            await db.execute(
                'UPDATE User SET last_login = NOW() WHERE user_id = ?',
                [user.user_id]
            );

            console.log('Existing user logged in:', user.email);
        }

        // Set session data
        req.session.userId = user.user_id;
        req.session.user = {
            id: user.user_id,
            email: user.email,
            name: user.name
        };

        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Session error'
                });
            }

            // Send success response
            res.json({
                success: true,
                user: {
                    id: user.user_id,
                    email: user.email,
                    name: user.name
                }
            });
        });

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed. Please try again.'
        });
    }
});

app.get('/api/auth/user', async (req, res) => {
    try {
        // Check if user is logged in (has session)
        if (!req.session || !req.session.userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }

        // Get user from database
        const [users] = await db.execute(
            `SELECT 
                user_id as id, 
                email, 
                name, 
                picture, 
                last_login,
                role 
            FROM User 
            WHERE user_id = ?`,
            [req.session.userId]
        );

        if (users.length === 0) {
            // User not found in database, clear session
            req.session.destroy();
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = users[0];

        // Update last_login timestamp
        await db.execute(
            'UPDATE User SET last_login = NOW() WHERE user_id = ?',
            [user.id]
        );


        res.json({
            success: true,
            id: user.user_id,
            email: user.email,
            name: user.name,
            picture: user.picture,
            created_at: user.created_at,
            role: user.role,
            last_login: user.last_login
        });

    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user data'
        });
    }
});

app.post('/api/auth/logout', (req, res) => {
    try {

        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to logout'
                });
            }

            // Clear the session cookie
            res.clearCookie('connect.sid');

            // Send success response
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout'
        });
    }
});

app.get('/*path', (req, res) => {
    res.sendFile(path.join(__dirname, '../', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

