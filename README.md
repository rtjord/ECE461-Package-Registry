# ECE461-Phase2 Project

## Overview
This project is a package registry designed for internal use by developers at ACME Corp. It provides functionality to:

- Upload packages
- Update packages with new versions
- Query package details
- Calculate the cost of a package and its dependencies

## Prerequisites
Ensure you have the following tools installed before proceeding:

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- [Docker](https://docs.docker.com/engine/install/)
- [Node.js and npm](https://nodejs.org/) (to build and run the application)

## Setup Instructions

### Clone the Repository
1. Clone this repository to your local machine:
   `git clone https://github.com/rtjord/ECE461-Phase2.git`
   `cd ECE461-Phase2`

### Install Dependencies
2. Install required dependencies for both the backend and frontend:
   - **Backend**:
     `cd backend`
     `npm install`
   - **Frontend**:
     `cd ../frontend`
     `npm install`

## Building the Project

### Backend
To build the backend application, run one of the following commands from the `backend` folder:
- For general environments:
  `npm run build`
- For Linux environments:
  `npm run build:linux`

### Frontend
To build the frontend application, run the following command from the `frontend` folder:
`npm run build`

## Deploying the Project

### Deploying the Backend
1. **Set Up AWS Environment**: Ensure you are signed into your AWS account as an administrator using the AWS CLI.
   
2. **Deploy the Backend**: Navigate to the `backend` folder and run:
   `sam deploy --guided`
   Follow the prompts to complete the deployment process.

### Deploying the Frontend
1. **Set Up AWS Amplify**:
   - Navigate to AWS Amplify in the AWS Management Console.
   - Follow the prompts to deploy the frontend from the `dev` branch.

2. **Configure Environment Variables**:
   - Navigate to **API Gateway > Stages > dev** in the AWS Management Console and copy the invoke URL.
   - In Amplify, create an environment variable named `NEXT_PUBLIC_API_BASE_URL` and set its value to the invoke URL.

3. **Verify Deployment**:
   - Visit the Amplify-provided URL to confirm the frontend is functioning as expected.

## Verification
- In backend/src/handlers/__tests__/end_to_end/config.ts, set the base url to the url provided by API Gateway. Then run the following commands
```sh
    cd backend
    npm run test:e2e
```
- Ensure the backend endpoints are functional using tools like Postman or curl.
- Test the frontend by accessing the deployed Amplify URL and interacting with the interface.

