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

