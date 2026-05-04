CREATE SCHEMA IF NOT EXISTS AH_Crowdsource_DB;
USE AH_Crowdsource_DB;

DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS Dataset;

CREATE TABLE IF NOT EXISTS User(
	user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    picture VARCHAR(255),
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
    role ENUM('admin', 'staff', 'student' ) DEFAULT 'student'

);

UPDATE User SET role = 'admin' WHERE user_id = 1;

CREATE TABLE IF NOT EXISTS Dataset(
    dataset_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    author VARCHAR(255),
    format VARCHAR(50),
    size VARCHAR(50),
    tags TEXT, -- Store as comma-separated values
    columns TEXT, -- Store as comma-separated values
    version VARCHAR(20),
    license VARCHAR(100),
    source TEXT,
    methodology TEXT,
    update_frequency VARCHAR(50),
    is_public BOOLEAN DEFAULT TRUE,
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    downloads INT DEFAULT 0,
    reviews INT DEFAULT 0,
    file_name VARCHAR(255),
    file_size BIGINT,
    uploaded_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES User(user_id) ON DELETE SET NULL
);


