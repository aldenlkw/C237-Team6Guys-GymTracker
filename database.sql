DROP DATABASE IF EXISTS c237_001_team6guys;
CREATE DATABASE c237_001_team6guys;
USE c237_001_team6guys;

CREATE TABLE users (
  userId INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exercises (
  exerciseId INT AUTO_INCREMENT PRIMARY KEY,
  exerciseName VARCHAR(100) NOT NULL,
  muscleGroup VARCHAR(50) NOT NULL
);

CREATE TABLE workouts (
  workoutId INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  exerciseId INT NOT NULL,
  weight DECIMAL(6,2) NOT NULL,
  reps INT NOT NULL,
  sets INT NOT NULL,
  workoutDate DATE NOT NULL,
  notes VARCHAR(255),
  FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
  FOREIGN KEY (exerciseId) REFERENCES exercises(exerciseId)
);

CREATE TABLE goals (
  goalId INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  exerciseId INT NOT NULL,
  targetWeight DECIMAL(6,2) NOT NULL,
  targetDate DATE NOT NULL,
  status ENUM('active','achieved') NOT NULL DEFAULT 'active',
  FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
  FOREIGN KEY (exerciseId) REFERENCES exercises(exerciseId)
);

CREATE TABLE comments (
  commentId INT AUTO_INCREMENT PRIMARY KEY,
  workoutId INT NOT NULL,
  adminId INT NOT NULL,
  commentText VARCHAR(500) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workoutId) REFERENCES workouts(workoutId) ON DELETE CASCADE,
  FOREIGN KEY (adminId) REFERENCES users(userId)
);

INSERT INTO exercises (exerciseName, muscleGroup) VALUES
('Barbell Bench Press','Chest'),
('Incline Dumbbell Press','Chest'),
('Cable Fly','Chest'),
('Push Up','Chest'),
('Deadlift','Back'),
('Barbell Row','Back'),
('Lat Pulldown','Back'),
('Pull Up','Back'),
('Back Squat','Legs'),
('Leg Press','Legs'),
('Romanian Deadlift','Legs'),
('Walking Lunge','Legs'),
('Overhead Press','Shoulders'),
('Lateral Raise','Shoulders'),
('Face Pull','Shoulders'),
('Barbell Curl','Arms'),
('Hammer Curl','Arms'),
('Tricep Pushdown','Arms'),
('Plank','Core'),
('Hanging Leg Raise','Core');