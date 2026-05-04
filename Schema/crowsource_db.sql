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

CREATE TABLE IF NOT EXISTS Dataset(
	dataset_id INT AUTO_INCREMENT PRIMARY KEY,
    rule VARCHAR(255),
    positive_count INT,
    negative_count INT

);


