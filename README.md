📝 School Management System – Assignment Submission
✅ Live Link (Hosted on Render)
🌐 Base URL:
https://school-management-api-s5g7.onrender.com

📂 GitHub Repository
💻 GitHub Repo:
https://github.com/Manikanta416/School-management

📮 Postman Collection
🔗 Drive Link to Collection JSON File:
https://drive.google.com/file/d/1VZrKqfBZgUSLuWoAYFghNfnxTZGl8sFp/view?usp=sharing

(Note: This file can be imported into Postman for testing all endpoints.)

📌 API Endpoints
#	Endpoint	Method	Description
1	/	GET	Base route, can be used for server up-check.
2	/health	GET	Checks database and server health status.
3	/addSchool	POST	Adds a new school with details like name, address, latitude, longitude.
4	/listSchools?latitude=17.385&longitude=78.4867	GET	Lists schools near the provided latitude and longitude.
5	/addStudent	POST	Adds a new student with name, age, grade, and school ID.
6	/students?school_id=1	GET	Retrieves all students from a specific school using school ID.
7	/deleteSchool/:id	DELETE	Deletes a school by its ID.
8	/deleteStudent/:id	DELETE	Deletes a student by their ID.

🛠 Sample Body Payloads
➕ Add School (POST /addSchool)
json
Copy
Edit
{
  "name": "ABC School",
  "address": "Hyderabad",
  "latitude": 17.385,
  "longitude": 78.4867
}
➕ Add Student (POST /addStudent)
json
Copy
Edit
{
  "name": "John Doe",
  "age": 15,
  "grade": "10",
  "school_id": 1
}
