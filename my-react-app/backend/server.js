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

