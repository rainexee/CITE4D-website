CREATE SCHEMA IF NOT EXISTS AH_Crowdsource_DB;
USE AH_Crowdsource_DB;

DROP TABLE IF EXISTS Student;
DROP TABLE IF EXISTS Dataset;

CREATE TABLE IF NOT EXISTS Student(
	user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    picture VARCHAR(255),
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS Dataset(
	dataset_id INT AUTO_INCREMENT PRIMARY KEY,
    rule VARCHAR(255),
    positive_count INT,
    negative_count INT

);

SELECT * FROM Student;

CREATE USER 'public_lowprio'@'localhost' IDENTIFIED BY 'n0root4u!';
CREATE USER 'cite4dsuperadmin'@'localhost' IDENTIFIED BY 'f4llr00taccess!';

GRANT ALL PRIVILEGES ON AH_Crowdsource_DB.* TO 'cite4dsuperadmin'@'localhost';
FLUSH PRIVILEGES;

GRANT SELECT, INSERT, UPDATE ON AH_Crowdsource_DB.* TO 'public_lowprio'@'localhost';
FLUSH PRIVILEGES;