🏫 School Management System API
A simple Node.js and Express.js-based API for managing schools and students, including nearby school search functionality.

🌐 Live API Link
Base URL:
https://school-management-api-s5g7.onrender.com

📂 Repository
GitHub Repo:
https://github.com/Manikanta416/School-management

📮 Postman Collection
Drive Link:
Download Postman Collection

📌 API Endpoints
Method	Endpoint	Description
GET	/	Base route - returns welcome message or base response
GET	/health	Checks if the server and DB are connected
POST	/addSchool	Adds a new school with name, address, latitude, and longitude
GET	/listSchools?latitude=...&longitude=...	Lists nearby schools based on provided coordinates
POST	/addStudent	Adds a student with name, age, grade, and school ID
GET	/students?school_id=...	Lists all students from the given school ID
DELETE	/deleteSchool/:id	Deletes a school using the school ID
DELETE	/deleteStudent/:id	Deletes a student using the student ID

📤 Sample Payloads
➕ Add School
Endpoint: POST /addSchool

json
Copy
Edit
{
  "name": "ABC School",
  "address": "Hyderabad",
  "latitude": 17.385,
  "longitude": 78.4867
}
➕ Add Student
Endpoint: POST /addStudent

json
Copy
Edit
{
  "name": "John Doe",
  "age": 15,
  "grade": "10",
  "school_id": 1
}
🛠 Technologies Used
Node.js

Express.js

MongoDB (with Mongoose)

Render for Deployment
