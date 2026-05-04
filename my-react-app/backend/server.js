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
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    bufferStream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            if (results.length === 0) {
                return res.status(400).json({ error: 'CSV file is empty' });
            }

            try {
                // Get columns from the first row of CSV
                const columns = Object.keys(results[0]);

                // Extract values for each row in the same order as columns
                const values = results.map(row => columns.map(col => row[col]));

                // Insert into the database using parameterized query for bulk insert
                const query = `INSERT INTO DATASET (??) VALUES ?`;
                await db.query(query, [columns, values]);

                res.json({ success: true, message: `Successfully uploaded ${results.length} rows to database.` });
            } catch (error) {
                console.error('Database error:', error);
                res.status(500).json({ error: 'Failed to insert data into database. Check if CSV columns match database schema.' });
            }
        })
        .on('error', (error) => {
            console.error('CSV Parsing error:', error);
            res.status(500).json({ error: 'Failed to parse CSV file' });
        });
});
// API routes (add your API endpoints here)
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

