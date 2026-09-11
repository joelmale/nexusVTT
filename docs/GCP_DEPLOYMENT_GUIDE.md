# Deploying Nexus VTT to Google Cloud Platform (GCP)

This is an experimental cloud deployment guide. The current production
deployment is the Dockhand-managed single-server Docker Compose homelab
described in `../DEPLOYMENT.md` and `HOMELAB_DEPLOYMENT.md`.

Use this guide when evaluating Google Cloud as one of the future cloud targets.
Keep cloud-specific choices out of the homelab runbook unless Google Cloud
becomes the live deployment target.

## Current Deployment Baseline

The repository already publishes production images to GitHub Container Registry:

- `ghcr.io/joelmale/nexusvtt/frontend`
- `ghcr.io/joelmale/nexusvtt/backend`
- `ghcr.io/joelmale/nexusvtt/asset-service`
- `ghcr.io/joelmale/nexusvtt/postgres`

For an initial GCP trial, the lowest-friction path is to reuse those images
instead of introducing a second image registry. Artifact Registry is still a
valid later step if you want cloud-local images.

## Table of Contents

- [Prerequisites](#prerequisites)
- [GCP Project Setup](#gcp-project-setup)
- [Free Tier Deployment on GCP](#free-tier-deployment-on-gcp)
- [Database and Cache Setup](#database-and-cache-setup)
- [Object Storage Setup](#object-storage-setup)
- [Search Service Setup](#search-service-setup)
- [Containerization](#containerization)
- [Kubernetes Deployment (GKE)](#kubernetes-deployment-gke)
- [Deployment Steps](#deployment-steps)
- [Verification](#verification)
- [CI/CD Automation (Optional)](#cicd-automation-optional)

## Free Tier Deployment on GCP

This section provides a guide for deploying the application on GCP's Free Tier. This approach uses a single `e2-micro` VM to run all the services, including the application, database, and cache. This is a manual but cost-effective way to run the application for development or small-scale use.

### 1. Create a GCE VM Instance

1.  **Create an `e2-micro` VM instance:**
    ```bash
    gcloud compute instances create nexus-vm --machine-type=e2-micro --image-family=ubuntu-2004-lts --image-project=ubuntu-os-cloud --boot-disk-size=30GB
    ```
    *We use a 30GB disk as the free tier allows for up to 30GB of standard persistent disk.*

2.  **SSH into the VM:**
    ```bash
    gcloud compute ssh nexus-vm
    ```

### 2. Install Docker and Docker Compose

1.  **Install Docker:**
    ```bash
    sudo apt-get update
    sudo apt-get install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    ```
    *You will need to log out and log back in for the group change to take effect.*

2.  **Install Docker Compose:**
    ```bash
    sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    ```

### 3. Configure and Run the Application

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/nexus-vtt.git
    cd nexus-vtt
    ```

2.  **Create a `docker-compose.prod.yml` file:**
    Create a new `docker-compose.prod.yml` file to define the production environment. This will be similar to the `docker-compose.integrated.yml` but adapted for a single VM.

    ```yaml
    version: '3.8'
    services:
      postgres:
        image: postgres:16-alpine
        environment:
          - POSTGRES_USER=nexus
          - POSTGRES_PASSWORD=password
        volumes:
          - postgres_data:/var/lib/postgresql/data
        restart: unless-stopped

      redis:
        image: redis:7-alpine
        restart: unless-stopped

      backend:
        image: us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nexus-images/backend:latest
        restart: unless-stopped
        ports:
          - "5001:5001"
        environment:
          - NODE_ENV=production
          - DATABASE_URL=postgresql://nexus:password@postgres:5432/nexus
          - REDIS_URL=redis://redis:6379
          # Add other environment variables here

      frontend:
        image: us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nexus-images/frontend:latest
        restart: unless-stopped
        ports:
          - "80:80"
        environment:
          - VITE_WS_URL=ws://<YOUR_VM_EXTERNAL_IP>:5001/ws

    volumes:
      postgres_data:
    ```

3.  **Update Environment Variables:**
    You will need to replace `<YOUR_VM_EXTERNAL_IP>` with the external IP of your VM. You can get this from the GCP console or by running `gcloud compute instances list`.

4.  **Build and Push Images:**
    Follow the steps in the [Containerization](#containerization) section to build and push your Docker images to Artifact Registry.

5.  **Run the application:**
    ```bash
    sudo /usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
    ```

### 4. Firewall Rules

Create a firewall rule to allow HTTP and WebSocket traffic to your VM:

```bash
gcloud compute firewall-rules create allow-http-ws --allow tcp:80,tcp:5001
```

### 5. Limitations

- The `e2-micro` instance has very limited resources (0.25 vCPU, 1 GB memory), so performance may be slow.
- This setup is not highly available or scalable.
- You are responsible for managing the database and other services running on the VM.
- Elasticsearch is not included in this setup due to its resource requirements. Features that rely on it will not work.

This Free Tier setup is a great way to get started and test the application, but for a production environment, the GKE deployment is recommended.

## Prerequisites

Before you begin, ensure you have the following installed and configured:

- **Google Cloud SDK (`gcloud`)**: [Installation Guide](https://cloud.google.com/sdk/docs/install)
- **`kubectl`**: [Installation Guide](https://kubernetes.io/docs/tasks/tools/install-kubectl-gcloud/)
- **Docker**: [Installation Guide](https://docs.docker.com/get-docker/)
- A GCP account with billing enabled.

## GCP Project Setup

1.  **Create a new GCP project:**
    ```bash
    gcloud projects create YOUR_PROJECT_ID --name="Nexus VTT"
    ```

2.  **Set your project as the default:**
    ```bash
    gcloud config set project YOUR_PROJECT_ID
    ```

3.  **Enable necessary APIs:**
    ```bash
    gcloud services enable \
        container.googleapis.com \
        sqladmin.googleapis.com \
        redis.googleapis.com \
        storage-component.googleapis.com \
        artifactregistry.googleapis.com
    ```

## Database and Cache Setup

### Cloud SQL for PostgreSQL

1.  **Create a Cloud SQL for PostgreSQL instance:**
    ```bash
    gcloud sql instances create nexus-postgres --database-version=POSTGRES_16 --region=us-central1 --cpu=2 --memory=4GB
    ```

2.  **Create a database:**
    ```bash
    gcloud sql databases create nexus --instance=nexus-postgres
    ```

3.  **Create a user:**
    ```bash
    gcloud sql users create nexus --instance=nexus-postgres --password="YOUR_DB_PASSWORD"
    ```

### Memorystore for Redis

1.  **Create a Memorystore for Redis instance:**
    ```bash
    gcloud redis instances create nexus-redis --size=1 --region=us-central1
    ```

## Object Storage Setup

### Google Cloud Storage

1.  **Create a Cloud Storage bucket:**
    ```bash
    gsutil mb -p YOUR_PROJECT_ID -l us-central1 gs://nexus-assets/
    ```
    This bucket will be used for storing assets, similar to MinIO in the Docker setup.

## Search Service Setup

### Elasticsearch

For Elasticsearch, you have a few options:

- **Elastic Cloud on GCP**: The recommended and easiest way. Deploy from the [GCP Marketplace](https://console.cloud.google.com/marketplace/product/elastic-inc/elastic-cloud).
- **Self-hosted on a GCE VM**: For more control, you can deploy Elasticsearch on a Google Compute Engine virtual machine.

Once you have your Elasticsearch instance running, you will need the connection URL and credentials.

## Containerization

### Build and Push Images to Artifact Registry

1.  **Create an Artifact Registry repository:**
    ```bash
    gcloud artifacts repositories create nexus-images --repository-format=docker --location=us-central1
    ```

2.  **Configure Docker to authenticate with Artifact Registry:**
    ```bash
    gcloud auth configure-docker us-central1-docker.pkg.dev
    ```

3.  **Build and push the Docker images:**
    - **Backend:**
      ```bash
      docker build -f docker/backend.Dockerfile -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nexus-images/backend:latest .
      docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nexus-images/backend:latest
      ```
    - **Frontend:**
      ```bash
      docker build -f docker/frontend.Dockerfile -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nexus-images/frontend:latest .
      docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nexus-images/frontend:latest
      ```

## Kubernetes Deployment (GKE)

### Create a GKE Cluster

1.  **Create a GKE cluster:**
    ```bash
    gcloud container clusters create nexus-cluster --num-nodes=3 --machine-type=e2-medium --region=us-central1
    ```

2.  **Get cluster credentials:**
    ```bash
    gcloud container clusters get-credentials nexus-cluster --region=us-central1
    ```

### Kubernetes Manifests

You will need to create Kubernetes manifest files for the backend and frontend. Here are some example manifests. You should create a `k8s` directory in the root of your project to store these files.

**`k8s/backend-deployment.yaml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nexus-images/backend:latest
        ports:
        - containerPort: 5001
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "5001"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: nexus-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: nexus-secrets
              key: REDIS_URL
        # Add other environment variables as secrets
```

**`k8s/backend-service.yaml`**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 5001
  type: ClusterIP
```

**`k8s/frontend-deployment.yaml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: us-central1-docker.pkg.dev/YOUR_PROJECT_ID/nexus-images/frontend:latest
        ports:
        - containerPort: 80
```

**`k8s/frontend-service.yaml`**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
spec:
  selector:
    app: frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: NodePort
```

**`k8s/ingress.yaml`**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nexus-ingress
spec:
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 80
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 80
```

### Secrets

Create a `secrets.yaml` file to manage your secrets. **Do not commit this file to version control.**

**`k8s/secrets.yaml`**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nexus-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgres://nexus:YOUR_DB_PASSWORD@<CLOUD_SQL_IP>/nexus"
  REDIS_URL: "redis://<REDIS_IP>:6379"
  # Add other secrets here
```

## Deployment Steps

1.  **Apply the secrets:**
    ```bash
    kubectl apply -f k8s/secrets.yaml
    ```

2.  **Apply the deployments and services:**
    ```bash
    kubectl apply -f k8s/backend-deployment.yaml
    kubectl apply -f k8s/backend-service.yaml
    kubectl apply -f k8s/frontend-deployment.yaml
    kubectl apply -f k8s/frontend-service.yaml
    ```

3.  **Apply the Ingress:**
    ```bash
    kubectl apply -f k8s/ingress.yaml
    ```

## Verification

1.  **Check the status of your pods:**
    ```bash
    kubectl get pods
    ```

2.  **Check the status of your services:**
    ```bash
    kubectl get services
    ```

3.  **Get the external IP of the Ingress:**
    ```bash
    kubectl get ingress nexus-ingress
    ```
    It may take a few minutes for an external IP to be assigned. Once it is, you can access your application at that IP address.

## CI/CD Automation (Optional)

For automated deployments, you can use Google Cloud Build. Create a `cloudbuild.yaml` file in your project root:

**`cloudbuild.yaml`**
```yaml
steps:
# Build and push backend image
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/nexus-images/backend:latest', '-f', 'docker/backend.Dockerfile', '.']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/nexus-images/backend:latest']

# Build and push frontend image
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/nexus-images/frontend:latest', '-f', 'docker/frontend.Dockerfile', '.']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/nexus-images/frontend:latest']

# Deploy to GKE
- name: 'gcr.io/cloud-builders/gke-deploy'
  args:
  - run
  - --filename=k8s/
  - --image=us-central1-docker.pkg.dev/$PROJECT_ID/nexus-images/backend:latest
  - --image=us-central1-docker.pkg.dev/$PROJECT_ID/nexus-images/frontend:latest
  - --location=us-central1
  - --cluster=nexus-cluster
```

You can then set up a trigger in Cloud Build to automatically build and deploy your application when you push to your Git repository.

## Cost Estimation

This section provides a rough estimate of the monthly costs for the GKE deployment described in this guide. These are estimates, and your actual costs may vary.

| Service                    | Configuration              | Estimated Monthly Cost |
| -------------------------- | -------------------------- | ---------------------- |
| GKE (Worker Nodes)         | 3 x `e2-medium`            | ~$84                   |
| Cloud SQL (PostgreSQL)     | `db-custom-2-4096` + 20GB  | ~$90                   |
| Memorystore (Redis)        | 1GB Basic Tier             | ~$49                   |
| Elasticsearch (Elastic Cloud) | Small production cluster   | ~$50 - $100            |
| **Total**                  |                            | **~$273 - $323**       |

### How to Reduce Costs

- **Use smaller machine types:** For a smaller application, you could use `e2-small` or even `e2-micro` nodes for the GKE cluster.
- **Use fewer nodes:** You could start with a 1 or 2-node cluster.
- **Use a smaller Cloud SQL instance:** A `db-g1-small` instance is cheaper.
- **Don't use Elasticsearch:** If the search functionality is not critical, you could disable it and save on that cost.
- **Use Preemptible VMs:** For non-critical workloads, you can use preemptible VMs for your GKE nodes, which are up to 80% cheaper but can be shut down at any time.
