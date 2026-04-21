CREATE SCHEMA IF NOT EXISTS AH_Crowdsource_DB;
USE AH_Crowdsource_DB;

CREATE TABLE IF NOT EXISTS Student(
	user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255),
    birthday DATETIME

);

CREATE TABLE IF NOT EXISTS Dataset(
	dataset_id INT AUTO_INCREMENT PRIMARY KEY,
    rule VARCHAR(255),
    positive_count INT,
    negative_count INT

);