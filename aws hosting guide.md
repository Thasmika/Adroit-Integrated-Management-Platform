# AWS Hosting Guide (EC2 & Docker)

This guide walks you through the process of setting up and hosting the Adroit Integrated Management Platform on a new AWS EC2 instance using Docker and Docker Compose.

## 1. Prerequisites
- An AWS Account
- The `aws.pem` file (your private SSH key) downloaded from AWS
- Source code (or a way to transfer it, like Git)

## 2. Setting Up the EC2 Instance
1. Go to the **EC2 Dashboard** in your AWS Console.
2. Click **Launch Instance**.
3. **Name:** Give your instance a name (e.g., `Adroit-Platform-Server`).
4. **AMI:** Choose **Ubuntu 22.04 LTS** (or 24.04).
5. **Instance Type:** Choose an appropriate instance type (e.g., `t3.medium` or `t3.large` depending on the application's resource needs).
6. **Key Pair:** Select the key pair associated with your `aws.pem` file.
7. **Network Settings (Security Group):**
   - Allow SSH traffic (Port `22`) from your IP (or anywhere).
   - Allow HTTP traffic (Port `80`) from the internet.
   - Allow HTTPS traffic (Port `443`) from the internet.
   - *Optional:* If your app uses custom ports directly (e.g., `3000`, `8080`), add Custom TCP rules for those ports.
8. **Storage:** Increase the root volume size to at least 20-30 GB.
9. Click **Launch Instance**.

## 3. Connecting to the Instance
Open your terminal (or PowerShell) on your local machine and navigate to where your `aws.pem` is located.

```bash
# If using Linux/macOS, ensure your key has the right permissions:
chmod 400 aws.pem

# Connect via SSH:
ssh -i "aws.pem" ubuntu@<YOUR_EC2_PUBLIC_IP>
```

## 4. Installing Docker and Docker Compose
Once connected to your EC2 instance, run the following commands to install Docker:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install ca-certificates curl gnupg lsb-release -y

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose plugin
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y

# Add your user to the docker group so you don't need 'sudo' for docker commands
sudo usermod -aG docker $USER
```
*(After running the last command, log out and log back into the EC2 instance for the changes to take effect).*

## 5. Setting Up the Project Folder
Now, create a new folder for your deployment and move your code there:

```bash
# Create the project directory
mkdir ~/adroit-platform
cd ~/adroit-platform
```

**Transferring your files:**
You can either clone your repository using Git:
```bash
git clone <your-repo-url> .
```
*Or*, if you want to copy files directly from your local machine, open a **new local terminal** and use SCP:
```bash
scp -i "aws.pem" docker-compose.yml .env ubuntu@<YOUR_EC2_PUBLIC_IP>:~/adroit-platform/
```
*(Make sure to copy all necessary folders, `docker-compose.yml`, and the `.env` file).*

## 6. Running the Application
Once your files are on the EC2 instance and your `.env` variables are correctly configured for production:

```bash
# Make sure you are in the project directory
cd ~/adroit-platform

# Start the application in the background
docker compose up -d --build
```

## 7. Verifying the Deployment
- Run `docker compose ps` to check that all containers are running successfully.
- Run `docker compose logs -f` to monitor the logs for any errors.
- Open your browser and navigate to `http://<YOUR_EC2_PUBLIC_IP>` to see the application live.

## Notes & Best Practices
- **Domain & SSL:** For production, point your domain name to the EC2 Public IP and set up an SSL certificate (e.g., using Nginx proxy manager or Traefik).
- **Elastic IP:** Assign an Elastic IP to your EC2 instance so the IP address doesn't change if you stop and start the instance.
- **Database Backups:** Ensure you have a strategy to back up your database volumes regularly.
