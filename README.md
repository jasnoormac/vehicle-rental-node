# 🚗 Vehicle Rental Management System (Node.js + MySQL)

A full-stack **Vehicle Rental Management System** built using **Node.js**, **Express**, **EJS**, **CSS**, and **MySQL**.  
This web app allows users to sign up, log in, book cars, choose insurance and accessories, make payments, and manage reservations.  
It includes session-based authentication, cookies, and complete CRUD functionality.

---

## 📦 Features

- 🔐 **User Authentication** — Signup & Login with hashed passwords
- 💾 **MySQL Integration** — All data (users, cars, locations, reservations, etc.) stored in MySQL
- 🍪 **Session Management** — Keeps users logged in until logout or browser close
- 🧭 **6+ Linked Pages**
  - Login / Signup  
  - Location Selection  
  - Car Selection  
  - Insurance  
  - Accessories  
  - Payment & Reservations
- 🧰 **CRUD Operations**
  - Create, Update, Delete Reservations
- 💳 **Payment Simulation**
  - Formatted card number input, masked CVV, live price totals
- 🎨 **Modern UI**
  - Clean EJS-based templates styled with CSS
- ✅ **Secure Environment**
  - Password hashing using bcrypt  
  - Session & cookie handling  

---

## ⚙️ Tech Stack

| Layer | Technology |
|--------|-------------|
| Frontend | EJS Templates, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MySQL |
| Authentication | express-session, bcrypt, cookie-parser |
| Environment Config | dotenv |

---

## 🧩 Folder Structure

vehicle-rental-node/
├── node_modules/
├── public/
│ ├── css/
│ │ └── style.css
│ └── js/
│ └── main.js
├── views/
│ ├── accessories.ejs
│ ├── cars.ejs
│ ├── insurance.ejs
│ ├── layout.ejs
│ ├── location.ejs
│ ├── login.ejs
│ ├── signup.ejs
│ ├── payment.ejs
│ ├── reservations.ejs
│ └── edit_reservation.ejs
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── server.js
└── README.md


---

## 🧠 Prerequisites

Before running the project, make sure you have:

- **Node.js** (v16 or later)  
- **npm** (Node Package Manager)  
- **MySQL Server** installed and running  
- A MySQL user with privileges to create databases and tables

---

## 🚀 Getting Started

Follow these steps to set up and run the project on your local machine.

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/<your-username>/vehicle-rental-node.git
cd vehicle-rental-node
npm install
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=car_rentals
SESSION_SECRET=someSuperSecretString
node server.js
Server running on http://localhost:3000
```
CREATE DATABASE car_rentals;
USE car_rentals;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255)
);

CREATE TABLE locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(100),
  branch_name VARCHAR(100)
);

CREATE TABLE cars (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model VARCHAR(100),
  transmission VARCHAR(50),
  color VARCHAR(50),
  seats INT,
  daily_price DECIMAL(10,2),
  location_id INT,
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE insurance_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  price_per_day DECIMAL(10,2),
  description TEXT
);

CREATE TABLE accessories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  price_flat DECIMAL(10,2),
  description TEXT
);

CREATE TABLE reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  car_id INT,
  location_id INT,
  insurance_id INT,
  start_date DATE,
  end_date DATE,
  total_price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE reservation_accessories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT,
  accessory_id INT,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id),
  FOREIGN KEY (accessory_id) REFERENCES accessories(id)
);
