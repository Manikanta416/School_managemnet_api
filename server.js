const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();



const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

let db;

async function initializeDatabase() {
    // Connect to MySQL server without specifying database first
    const initialDb = mysql.createConnection({
        host: process.env.DB_HOST,       // sql5.freesqldatabase.com
        user: process.env.DB_USER,       // sql5780742
        password: process.env.DB_PASSWORD, // 1XANHks1Zs
        port: 3306                       // default MySQL port
    });

    return new Promise((resolve, reject) => {
        initialDb.connect((err) => {
            if (err) {
                console.error('Initial database connection failed:', err);
                reject(err);
                return;
            }

            console.log('Connected to MySQL server');

            const dbName = process.env.DB_NAME; // sql5780742 (same as user here)

            // Create database only if it does not exist
            initialDb.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (err) => {
                if (err) {
                    console.error('Error creating database:', err);
                    initialDb.end();
                    reject(err);
                    return;
                }

                console.log(`Database ${dbName} is ready`);
                initialDb.end();

                // Connect to the actual database now
                db = mysql.createConnection({
                    host: process.env.DB_HOST,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    database: process.env.DB_NAME,
                    port: 3306
                });

                db.connect((err) => {
                    if (err) {
                        console.error('Database connection failed:', err);
                        reject(err);
                        return;
                    }

                    console.log('Connected to MySQL database');
                    createSchoolsTable();
                    resolve();
                });
            });
        });
    });
}

function createSchoolsTable() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS schools (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            address VARCHAR(500) NOT NULL,
            latitude FLOAT NOT NULL,
            longitude FLOAT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    db.query(createTableQuery, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Schools table ready');
        }
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
}

const validateSchoolInput = (req, res, next) => {
    const { name, address, latitude, longitude } = req.body;

    if (!name || !address || latitude === undefined || longitude === undefined) {
        return res.status(400).json({
            success: false,
            message: 'All fields (name, address, latitude, longitude) are required'
        });
    }

    if (typeof name !== 'string' || typeof address !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Name and address must be strings'
        });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({
            success: false,
            message: 'Latitude and longitude must be valid numbers'
        });
    }

    if (lat < -90 || lat > 90) {
        return res.status(400).json({
            success: false,
            message: 'Latitude must be between -90 and 90'
        });
    }

    if (lon < -180 || lon > 180) {
        return res.status(400).json({
            success: false,
            message: 'Longitude must be between -180 and 180'
        });
    }

    if (name.trim().length === 0 || name.length > 255) {
        return res.status(400).json({
            success: false,
            message: 'School name cannot be empty and must be less than 255 characters'
        });
    }

    if (address.trim().length === 0 || address.length > 500) {
        return res.status(400).json({
            success: false,
            message: 'Address cannot be empty and must be less than 500 characters'
        });
    }

    req.validatedData = {
        name: name.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lon
    };

    next();
};

app.post('/addSchool', validateSchoolInput, (req, res) => {
    const { name, address, latitude, longitude } = req.validatedData;

    const query = 'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)';

    db.query(query, [name, address, latitude, longitude], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to add school to database'
            });
        }

        res.status(201).json({
            success: true,
            message: 'School added successfully',
            data: {
                id: result.insertId,
                name,
                address,
                latitude,
                longitude
            }
        });
    });
});

app.get('/listSchools', (req, res) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).json({
            success: false,
            message: 'User latitude and longitude are required as query parameters'
        });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    if (isNaN(userLat) || isNaN(userLon)) {
        return res.status(400).json({
            success: false,
            message: 'Latitude and longitude must be valid numbers'
        });
    }

    if (userLat < -90 || userLat > 90 || userLon < -180 || userLon > 180) {
        return res.status(400).json({
            success: false,
            message: 'Invalid coordinate values'
        });
    }

    const query = 'SELECT * FROM schools ORDER BY created_at DESC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch schools from database'
            });
        }

        const schoolsWithDistance = results.map(school => {
            const distance = calculateDistance(
                userLat,
                userLon,
                school.latitude,
                school.longitude
            );

            return {
                ...school,
                distance: Math.round(distance * 100) / 100
            };
        });

        schoolsWithDistance.sort((a, b) => a.distance - b.distance);

        res.json({
            success: true,
            message: 'Schools retrieved and sorted by proximity',
            userLocation: {
                latitude: userLat,
                longitude: userLon
            },
            count: schoolsWithDistance.length,
            data: schoolsWithDistance
        });
    });
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'School Management API is running',
        timestamp: new Date().toISOString()
    });
});

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`School Management API server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    db.end();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    db.end();
    process.exit(0);
});
