const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

let pool;

async function initializeDatabase() {
    try {
        // PostgreSQL connection configuration
        let config;

        if (process.env.DATABASE_URL) {
            config = {
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true' ? {
                    rejectUnauthorized: false
                } : false
            };
        } else {
            // Alternative configuration using individual environment variables
            config = {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT || 5432,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true' ? {
                    rejectUnauthorized: false
                } : false
            };
        }

        // Create connection pool
        pool = new Pool(config);

        // Test the connection
        const client = await pool.connect();
        console.log('Connected to PostgreSQL database');
        
        // Create the schools table
        await createSchoolsTable(client);
        
        client.release();
        
    } catch (err) {
        console.error('Database initialization failed:', err);
        throw err;
    }
}

async function createSchoolsTable(client) {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS schools (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            address VARCHAR(500) NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    try {
        await client.query(createTableQuery);
        console.log('Schools table ready');
    } catch (err) {
        console.error('Error creating table:', err);
        throw err;
    }
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

// Add School Endpoint
app.post('/addSchool', validateSchoolInput, async (req, res) => {
    const { name, address, latitude, longitude } = req.validatedData;

    const query = 'INSERT INTO schools (name, address, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *';

    try {
        const result = await pool.query(query, [name, address, latitude, longitude]);
        const insertedSchool = result.rows[0];

        res.status(201).json({
            success: true,
            message: 'School added successfully',
            data: {
                id: insertedSchool.id,
                name: insertedSchool.name,
                address: insertedSchool.address,
                latitude: insertedSchool.latitude,
                longitude: insertedSchool.longitude,
                created_at: insertedSchool.created_at
            }
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to add school to database',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// List Schools Endpoint
app.get('/listSchools', async (req, res) => {
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

    try {
        const result = await pool.query(query);
        const schools = result.rows;

        const schoolsWithDistance = schools.map(school => {
            const distance = calculateDistance(
                userLat,
                userLon,
                school.latitude,
                school.longitude
            );

            return {
                id: school.id,
                name: school.name,
                address: school.address,
                latitude: school.latitude,
                longitude: school.longitude,
                created_at: school.created_at,
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
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch schools from database',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Get Single School Endpoint
app.get('/school/:id', async (req, res) => {
    const schoolId = parseInt(req.params.id);

    if (isNaN(schoolId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid school ID'
        });
    }

    const query = 'SELECT * FROM schools WHERE id = $1';

    try {
        const result = await pool.query(query, [schoolId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.json({
            success: true,
            message: 'School retrieved successfully',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch school from database',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Update School Endpoint
app.put('/school/:id', validateSchoolInput, async (req, res) => {
    const schoolId = parseInt(req.params.id);
    const { name, address, latitude, longitude } = req.validatedData;

    if (isNaN(schoolId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid school ID'
        });
    }

    const query = `
        UPDATE schools 
        SET name = $1, address = $2, latitude = $3, longitude = $4 
        WHERE id = $5 
        RETURNING *
    `;

    try {
        const result = await pool.query(query, [name, address, latitude, longitude, schoolId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.json({
            success: true,
            message: 'School updated successfully',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to update school',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Delete School Endpoint
app.delete('/school/:id', async (req, res) => {
    const schoolId = parseInt(req.params.id);

    if (isNaN(schoolId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid school ID'
        });
    }

    const query = 'DELETE FROM schools WHERE id = $1 RETURNING *';

    try {
        const result = await pool.query(query, [schoolId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.json({
            success: true,
            message: 'School deleted successfully',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to delete school',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Health Check Endpoint
app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            success: true,
            message: 'School Management API is running',
            database: 'Connected',
            timestamp: new Date().toISOString(),
            dbTime: result.rows[0].now
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'School Management API is running but database connection failed',
            database: 'Disconnected',
            timestamp: new Date().toISOString(),
            error: err.message
        });
    }
});

// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        availableEndpoints: {
            'POST /addSchool': 'Add a new school',
            'GET /listSchools?latitude=X&longitude=Y': 'List schools sorted by distance',
            'GET /school/:id': 'Get a specific school',
            'PUT /school/:id': 'Update a specific school',
            'DELETE /school/:id': 'Delete a specific school',
            'GET /health': 'Health check'
        }
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Initialize and Start Server
initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`School Management API server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log('Available endpoints:');
            console.log('- POST /addSchool');
            console.log('- GET /listSchools?latitude=X&longitude=Y');
            console.log('- GET /school/:id');
            console.log('- PUT /school/:id');
            console.log('- DELETE /school/:id');
            console.log('- GET /health');
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

// Graceful Shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});