# Web GIS: Spatial Data Management System

This repository contains the source code and documentation for a full-stack Web GIS application developed as a final capstone project. The system facilitates the management, visualization, and administration of spatial data through a RESTful API architecture, serving as a lightweight and scalable alternative to traditional GIS servers.

## Deployment & Documentation

* **Live Application:** [https://gmt-458-web-gis-final-assignment-full.onrender.com](https://gmt-458-web-gis-final-assignment-full.onrender.com)
* **API Documentation (Swagger UI):**

---

## Project Overview & Features

### 1. User Authentication and Role-Based Access Control (RBAC)
The system implements a secure authentication mechanism using **JSON Web Tokens (JWT)**. Password security is ensured through **bcrypt** hashing algorithms. To satisfy the requirement for multiple user types, the system defines three distinct roles:
* **Guest:** Restricted access; can view the landing page but cannot access spatial data.
* **User:** Authorized to view all data and create new points. Users are restricted to editing or deleting only the data they have created (Ownership Rule).
* **Admin:** Possesses superuser privileges, including the ability to manage, edit, and delete any spatial feature within the database.

### 2. Spatial CRUD Operations
The application supports full Create, Read, Update, and Delete (CRUD) operations for spatial data:
* **Spatial Data Creation:** Users can generate point features by interacting directly with the map interface (Right-click event listener).
* **Data Retrieval:** Spatial data is queried from the PostGIS database and rendered on the client-side using Leaflet.js.
* **Modification:** Metadata (Name, Description) of spatial features can be updated via the API.
* **Deletion:** Features can be removed from the database based on the user's permission level.

### 3. REST API Architecture
The backend exposes a fully documented REST API compliant with OpenAPI 3.0 standards.
* **Endpoints include:**
    * `GET /api/layer/points`: Retrives GeoJSON data.
    * `POST /api/layer/points`: Accepts coordinate data to create features.
    * `PUT /api/layer/points/:id`: Updates feature attributes.
    * `DELETE /api/layer/points/:id`: Removes features.

### 4. Performance Monitoring & Load Testing
System stability and response times were evaluated using the **Artillery** load testing framework.
* **Test Scenario:** The system was subjected to a stress test simulating 20 concurrent virtual users over a 20-second interval.
* **Results:** The API demonstrated low latency (<200ms p95 response time) and high availability under load. Detailed graphs and reports are included in the project documentation.

---

## Architectural Decisions & Technical Justifications

### Custom Node.js API vs. GeoServer
While GeoServer provides standard WMS/WFS services, a custom **Node.js + Express** architecture was selected for this project.
* **Resource Efficiency:** GeoServer requires significant RAM and CPU resources (Java-based), which is inefficient for cloud environments with limited quotas (e.g., Render Free Tier). The Node.js runtime offers a lightweight, event-driven alternative.
* **Security Flexibility:** Implementing custom RBAC logic (e.g., "Users can only delete their own points") is complex in standard WFS services. A custom API allows for precise middleware-based permission control.

### PostgreSQL/PostGIS vs. NoSQL
A relational database (RDBMS) was chosen over NoSQL solutions for the following reasons:
* **Spatial Standards:** PostGIS is the industry standard for spatial indexing (GIST) and geometric operations, offering superior performance for geospatial queries compared to many NoSQL spatial implementations.
* **Data Integrity:** The need to manage relations between Users and Spatial Features (Foreign Keys) necessitated an ACID-compliant database structure.

### Cloud Hosting(AWS baseed)
The application and database are deployed on **Render Cloud** to ensure 24/7 accessibility, demonstrating the capability to manage production-level deployments.

---

## Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js | Event-driven JavaScript runtime |
| **Web Framework** | Express.js | Minimalist web framework for API routing |
| **Database** | PostgreSQL + PostGIS | Object-relational database with spatial extension |
| **Frontend Library** | Leaflet.js | Open-source JavaScript library for interactive maps |
| **Authentication** | JWT & bcrypt | Secure session handling and encryption |
| **Documentation** | Swagger (OpenAPI) | Interface description language for REST APIs |
| **Testing** | Artillery | Modern load testing toolkit |
