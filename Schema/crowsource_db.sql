CREATE SCHEMA IF NOT EXISTS AH_Crowdsource_DB;
USE AH_Crowdsource_DB;

DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS Dataset;
DROP TABLE IF EXISTS DatasetAnnotation;
DROP TABLE IF EXISTS DataPointAnnotation;
DROP TABLE IF EXISTS AnnotationVote;

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

-- Table for dataset-level annotations
CREATE TABLE IF NOT EXISTS DatasetAnnotation (
    annotation_id INT PRIMARY KEY AUTO_INCREMENT,
    dataset_id INT NOT NULL,
    user_id INT NOT NULL,
    annotation_text TEXT NOT NULL,
    annotation_type ENUM('general', 'methodology', 'quality', 'caution', 'insight', 'question') DEFAULT 'general',
    is_resolved BOOLEAN DEFAULT FALSE,
    parent_annotation_id INT NULL, -- For replies/threads
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dataset_id) REFERENCES Dataset(dataset_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_annotation_id) REFERENCES DatasetAnnotation(annotation_id) ON DELETE CASCADE,
    INDEX idx_dataset (dataset_id),
    INDEX idx_user (user_id),
    INDEX idx_parent (parent_annotation_id)
);

-- Table for row/column specific annotations
CREATE TABLE IF NOT EXISTS DataPointAnnotation (
    data_annotation_id INT PRIMARY KEY AUTO_INCREMENT,
    dataset_id INT NOT NULL,
    user_id INT NOT NULL,
    row_index INT NULL, -- row number (0-indexed)
    column_name VARCHAR(255) NULL,
    original_value TEXT NULL,
    annotation_text TEXT NOT NULL,
    annotation_type ENUM('error', 'missing', 'outlier', 'correction', 'note', 'question') DEFAULT 'note',
    suggested_correction TEXT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (dataset_id) REFERENCES Dataset(dataset_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    INDEX idx_dataset (dataset_id),
    INDEX idx_user (user_id),
    INDEX idx_row (row_index),
    INDEX idx_column (column_name)
);

-- Table for annotation votes/likes
CREATE TABLE IF NOT EXISTS AnnotationVote (
    vote_id INT PRIMARY KEY AUTO_INCREMENT,
    annotation_id INT NOT NULL,
    user_id INT NOT NULL,
    vote_type ENUM('upvote', 'downvote') DEFAULT 'upvote',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (annotation_id) REFERENCES DatasetAnnotation(annotation_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote (annotation_id, user_id),
    INDEX idx_annotation (annotation_id)
);


