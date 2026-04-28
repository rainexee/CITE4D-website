const express = require('express');
const mysql = require('mysql2/promise');
const rateLimit = require("express-rate-limit");
const cors = require('cors');
const session = require('express-session');
const nodemailer = require("nodemailer");
const path = require('path');
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

app.use(express.static(__dirname));

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

app.use(session({
    secret: process.env.SESSION_SECRET,
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

app.post('/api/upload', (req, res) => {
    const { upload } = req.body;

    if (!upload || typeof upload !== 'string') {
        return res.status(400).json({ error: 'Rule must be a valid input!' });
    }

    //security testing for filesize
    if (upload.length > 255) {
        return res.status(400).json({ error: 'Rule cannot exceed 255 characters' });
    }

    // fix later on
    db.query('INSERT INTO DATASET ? VALUES ? ? ? ? ?');
})