Assignment 1 - REST API Project - Response to Criteria
================================================

Overview
------------------------------------------------

- **Name:** Wanying Zhou
- **Student number:**N11851287
- **Application name:** game-media-app
- **Two line description:**  The application is a **containerized video media platform** developed with **Node.js, Express, MongoDB, and Docker**. It provides **RESTful APIs** for video upload, listing, deletion, and transcoding, using **FFmpeg** to generate multiple resolutions (e.g., 720p, 480p). The app is fully **containerized**, stored in **AWS ECR**, and deployed on **EC2** with Docker Compose.


Core criteria
------------------------------------------------

### Containerise the app

- **ECR Repository name:** game-media-app
- **Video timestamp:** 0:00-0:20
- **Relevant files:**
    - Dockerfile

### Deploy the container

- **EC2 instance ID:** i-0cf0c50d20b0cb6f4
- **Video timestamp:** 0:20-0:56

### User login

- **One line description:** Users can log in as “admin”(password: admin123) or “player.”(password: player123) Players can only view content they have uploaded, while admins can view and manage all content. Authentication is implemented using JWT.
- **Video timestamp:** 1:14-1:56
- **Relevant files:**
    - src\middleware\auth.js
    - src\controllers\authController.js

### REST API

- **One line description:** Implement video upload, transcoding, viewing by ID, and deletion by ID. Implement image upload, processing, viewing by ID, and deletion by ID.
- **Video timestamp:** 1:14-2:05
- **Relevant files:**
    - src\controllers
    - src\routes

### Data types

- **One line description:** Unstructured data consists of video/image files; structured data consists of MongoDB documents that store tasks/metadata and permissions.
- **Video timestamp:** 3:16-3:45
- **Relevant files:**
    - uploads/, outputs/
    - src/models/Video.js`, `src/models/Screenshot.js`, `src/models/Task.js

#### First kind

- **One line description:** Original video and transcoded output file
- **Type:** Unstructured, file(image, video)
- **Rationale:** Large volume, application does not parse the content itself, only saves the path and metadata
- **Video timestamp:** 3:16-3:36
- **Relevant files:**
    - uploads/
    - outputs/

#### Second kind

- **One line description:** Video/screenshot indexing and metadata (game, owner, transcoded, outputs, etc.)
- **Type:** Structured (MongoDB)
- **Rationale:** Requires retrieval, pagination, filtering, and permission verification.
- **Video timestamp:** 3:36-3:45
- **Relevant files:**
  - src/models/*.js
  - src/controllers/*Controller.js

### CPU intensive task

 **One line description:** Use FFmpeg to perform multi-resolution transcoding (720p/480p/360p)
- **Video timestamp:** 3:45-3:54
- **Relevant files:**
    - src/utils/ffmpeg.js
    - src/controllers/videoController.js（POST /videos/:id/transcode）

### CPU load testing

 **One line description:** Use a minimal script to repeatedly trigger the transcoding interface, continuously pushing the CPU to its limits.
- **Video timestamp:** 3:54-4:59
- **Relevant files:**
    - load.sh

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description:** In terms of extended features, I implemented API versioning, pagination, filtering, and sorting.
- **Video timestamp:** 2:05-2:35
- **Relevant files:**
    - src\controllers\videoController.js
    - src\controllers\screenshotController.js

### External API

- **One line description:** The external API uses the Wikipedia Summary interface to obtain game descriptions and thumbnails, and writes them to the video metadata (gameInfo). It can be queried independently and will also automatically retrieve data during upload.
- **Video timestamp:** 2:49-3:16
- **Relevant files:**
    - src\utils\gameInfo.js
    - src\controllers\videoController.js

### Additional types of data

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 

### Custom processing

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 

### Infrastructure as code

- **One line description:** Use docker-compose.yml to define app+mongo and deploy with one click.
- **Video timestamp:**
- **Relevant files:** 0:20-0:50
    - docker-compose.yml

### Web Client

- **One line description:** Pure front-end page covering login, upload, trigger transcoding, list, and delete

- **Video timestamp:** 0:57-2:06

- **Relevant files:**

    public/index.html

    
