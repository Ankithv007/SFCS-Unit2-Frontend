pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 45, unit: 'MINUTES')
    }

    environment {
        // Docker Hub
        IMAGE_REPO = 'ankithbv007/sfcs-unit2-frontend'
        DOCKERHUB_CREDS = 'dockerhub-token'

        // Production application server
        APP_HOST = 'REPLACE_WITH_YOUR_SERVER_IP'
        APP_DIR = '/opt/sfcs-unit2'
        SSH_CREDS = 'sfcs-production-ssh'

        // Docker Compose configuration
        COMPOSE_SERVICE = 'gateway'
        TAG_KEY = 'FRONTEND_TAG'

        // Temporary smoke-test container
        SMOKE_PORT = '18081'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm

                script {
                    env.GIT_COMMIT_FULL = sh(
                        script: 'git rev-parse HEAD',
                        returnStdout: true
                    ).trim()

                    env.GIT_COMMIT_SHORT = env.GIT_COMMIT_FULL.take(12)
                }

                sh '''
                    set -eu

                    echo "======================================"
                    echo "SFCS Frontend CI/CD"
                    echo "======================================"
                    echo "Commit: $GIT_COMMIT_FULL"
                    echo "Short SHA: $GIT_COMMIT_SHORT"

                    test -f package.json
                    test -f package-lock.json
                    test -f nginx.conf

                    git diff --quiet
                    echo "Source files verified."
                '''
            }
        }

        stage('Validate Environment') {
            steps {
                sh '''
                    set -eu

                    docker version
                    docker info >/dev/null

                    command -v curl >/dev/null 2>&1 || {
                        echo "ERROR: curl is required on the Jenkins agent."
                        exit 1
                    }

                    echo "Docker and curl are available."
                '''
            }
        }

        stage('Build Frontend') {
            steps {
                sh '''
                    set -eu

                    echo "Installing dependencies and building React/Vite..."

                    docker run --rm \
                        -v "$WORKSPACE:/app" \
                        -w /app \
                        node:22-alpine \
                        sh -ec 'npm ci && npm run build'

                    test -s dist/index.html

                    echo "Frontend build successful."
                '''
            }
        }

        stage('Build Commit-Tagged Image') {
            steps {
                sh '''
                    set -eu

                    echo "Building production image for commit:"
                    echo "$GIT_COMMIT_FULL"

                    BUILD_CONTEXT="$(mktemp -d)"

                    trap 'rm -rf "$BUILD_CONTEXT"' EXIT

                    cp -a dist/. "$BUILD_CONTEXT/"
                    cp nginx.conf "$BUILD_CONTEXT/nginx.conf"

                    docker build \
                        --pull \
                        --label "org.opencontainers.image.title=SFCS-Frontend" \
                        --label "org.opencontainers.image.revision=$GIT_COMMIT_FULL" \
                        --label "org.opencontainers.image.source=https://github.com/Ankithv007/SFCS-Unit2-Frontend" \
                        --tag "$IMAGE_REPO:$GIT_COMMIT_FULL" \
                        -f- "$BUILD_CONTEXT" <<'DOCKERFILE'
FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY . /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
    --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

                    echo "Image built:"
                    echo "$IMAGE_REPO:$GIT_COMMIT_FULL"
                '''
            }
        }

        stage('Validate Docker Image') {
            steps {
                sh '''
                    set -eu

                    IMAGE="$IMAGE_REPO:$GIT_COMMIT_FULL"
                    SMOKE_NAME="sfcs-frontend-smoke-$BUILD_NUMBER"

                    cleanup() {
                        docker rm -f "$SMOKE_NAME" >/dev/null 2>&1 || true
                    }

                    trap cleanup EXIT

                    echo "Validating Nginx configuration..."

                    docker run --rm \
                        --add-host=backend-login:127.0.0.1 \
                        --add-host=backend-inventory:127.0.0.1 \
                        --add-host=backend-pretest:127.0.0.1 \
                        --add-host=backend-qc-inspection:127.0.0.1 \
                        --add-host=backend-vacuum-leak-test:127.0.0.1 \
                        --add-host=backend-smt:127.0.0.1 \
                        --add-host=backend-backend:127.0.0.1 \
                        --add-host=backend-rrh:127.0.0.1 \
                        "$IMAGE" nginx -t

                    echo "Starting temporary smoke-test container..."

                    docker run -d \
                        --name "$SMOKE_NAME" \
                        -p "127.0.0.1:$SMOKE_PORT:80" \
                        --add-host=backend-login:127.0.0.1 \
                        --add-host=backend-inventory:127.0.0.1 \
                        --add-host=backend-pretest:127.0.0.1 \
                        --add-host=backend-qc-inspection:127.0.0.1 \
                        --add-host=backend-vacuum-leak-test:127.0.0.1 \
                        --add-host=backend-smt:127.0.0.1 \
                        --add-host=backend-backend:127.0.0.1 \
                        --add-host=backend-rrh:127.0.0.1 \
                        "$IMAGE"

                    HEALTHY=0

                    for attempt in $(seq 1 20); do
                        if curl -fsS \
                            "http://127.0.0.1:$SMOKE_PORT/" \
                            -o /dev/null; then
                            HEALTHY=1
                            break
                        fi

                        echo "Smoke test attempt $attempt failed."
                        sleep 3
                    done

                    if [ "$HEALTHY" -ne 1 ]; then
                        docker logs "$SMOKE_NAME" || true
                        echo "ERROR: Docker image smoke test failed."
                        exit 1
                    fi

                    echo "Docker image validation successful."
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-token',
                        usernameVariable: 'DH_USER',
                        passwordVariable: 'DH_TOKEN'
                    )
                ]) {
                    sh '''
                        set -eu

                        IMAGE="$IMAGE_REPO:$GIT_COMMIT_FULL"

                        cleanup() {
                            docker logout >/dev/null 2>&1 || true
                        }

                        trap cleanup EXIT

                        echo "$DH_TOKEN" | docker login \
                            --username "$DH_USER" \
                            --password-stdin

                        echo "Pushing immutable image: $IMAGE"

                        docker push "$IMAGE"

                        echo "Docker Hub push successful."
                    '''
                }
            }
        }

        stage('Deploy to Production') {
            steps {
                script {
                    if (env.APP_HOST == 'REPLACE_WITH_YOUR_SERVER_IP') {
                        error(
                            'Configure APP_HOST with the actual application server IP or hostname.'
                        )
                    }
                }

                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'sfcs-production-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        set -eu

                        echo "Deploying to application server..."
                        echo "Host: $APP_HOST"
                        echo "Directory: $APP_DIR"
                        echo "Service: $COMPOSE_SERVICE"
                        echo "Image: $IMAGE_REPO:$GIT_COMMIT_FULL"

                        test -r "$SSH_KEY"

                        ssh \
                            -i "$SSH_KEY" \
                            -o BatchMode=yes \
                            -o StrictHostKeyChecking=yes \
                            -o ConnectTimeout=15 \
                            "$SSH_USER@$APP_HOST" \
                            "bash -s -- '$IMAGE_REPO' '$GIT_COMMIT_FULL' '$APP_DIR' '$COMPOSE_SERVICE' '$TAG_KEY'" \
                            <<'REMOTE_SCRIPT'

                        set -Eeuo pipefail

                        IMAGE_REPO="$1"
                        NEW_TAG="$2"
                        APP_DIR="$3"
                        SERVICE="$4"
                        TAG_KEY="$5"

                        cd "$APP_DIR"

                        ENV_FILE="$APP_DIR/.env"
                        LOCK_FILE="$APP_DIR/.deploy.lock"

                        test -f "$ENV_FILE"
                        test -f "$APP_DIR/docker-compose.yml"

                        # The deployment lock must be shared by every
                        # pipeline that changes the production application.
                        exec 9>"$LOCK_FILE"

                        if ! flock -w 300 9; then
                            echo "ERROR: Could not acquire deployment lock."
                            exit 1
                        fi

                        echo "Deployment lock acquired."

                        # Validate the commit-based tag.
                        if ! [[ "$NEW_TAG" =~ ^[0-9a-f]{40}$ ]]; then
                            echo "ERROR: Invalid full Git commit SHA."
                            exit 1
                        fi

                        if ! grep -q "^${TAG_KEY}=" "$ENV_FILE"; then
                            echo "ERROR: $TAG_KEY is missing from .env."
                            exit 1
                        fi

                        OLD_TAG="$(
                            grep "^${TAG_KEY}=" "$ENV_FILE" |
                            tail -n 1 |
                            cut -d '=' -f 2-
                        )"

                        if [ -z "$OLD_TAG" ]; then
                            echo "ERROR: Existing production tag is empty."
                            exit 1
                        fi

                        echo "Previous frontend tag: $OLD_TAG"
                        echo "New frontend tag: $NEW_TAG"

                        # Update only the requested tag while preserving
                        # all other environment variables and secrets.
                        update_tag() {
                            python3 - "$ENV_FILE" "$TAG_KEY" "$1" <<'PY'
import os
import sys
import tempfile

path, key, value = sys.argv[1:4]

with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

prefix = key + "="
updated = []
found = False

for line in lines:
    if line.startswith(prefix):
        if not found:
            updated.append(f"{key}={value}\n")
            found = True
    else:
        updated.append(line)

if not found:
    raise SystemExit(f"Missing required variable: {key}")

directory = os.path.dirname(path)
mode = os.stat(path).st_mode & 0o777

fd, temp_path = tempfile.mkstemp(
    prefix=".env.",
    dir=directory,
    text=True
)

try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.writelines(updated)
        f.flush()
        os.fsync(f.fileno())

    os.chmod(temp_path, mode)
    os.replace(temp_path, path)

except Exception:
    try:
        os.unlink(temp_path)
    except FileNotFoundError:
        pass
    raise
PY
                        }

                        # Validate Compose, pull the exact image, recreate
                        # only the gateway, and verify its HTTP response.
                        deploy_new() (
                            set -Eeuo pipefail

                            update_tag "$NEW_TAG"

                            docker compose config --quiet

                            docker compose pull "$SERVICE"

                            docker compose up -d \
                                --no-deps \
                                "$SERVICE"

                            HEALTHY=0

                            for attempt in $(seq 1 30); do
                                if docker compose ps --status running \
                                    --services "$SERVICE" |
                                    grep -Fxq "$SERVICE"; then

                                    if curl --fail --silent --show-error \
                                        --max-time 5 \
                                        http://127.0.0.1/ \
                                        -o /dev/null; then

                                        HEALTHY=1
                                        break
                                    fi
                                fi

                                echo "Production health check attempt $attempt failed."
                                sleep 3
                            done

                            if [ "$HEALTHY" -ne 1 ]; then
                                echo "ERROR: New deployment failed health checks."
                                docker compose logs --tail=100 "$SERVICE" || true
                                exit 1
                            fi
                        )

                        rollback() {
                            echo "Attempting frontend rollback to $OLD_TAG..."

                            if update_tag "$OLD_TAG" &&
                               docker compose config --quiet &&
                               docker compose pull "$SERVICE" &&
                               docker compose up -d --no-deps "$SERVICE"; then

                                for attempt in $(seq 1 20); do
                                    if curl --fail --silent \
                                        --max-time 5 \
                                        http://127.0.0.1/ \
                                        -o /dev/null; then

                                        echo "Rollback successful."
                                        return 0
                                    fi

                                    sleep 3
                                done
                            fi

                            echo "CRITICAL: Automatic rollback could not be verified."
                            docker compose logs --tail=100 "$SERVICE" || true
                            return 1
                        }

                        if deploy_new; then
                            echo "======================================"
                            echo "FRONTEND DEPLOYMENT SUCCESSFUL"
                            echo "======================================"
                            echo "Image: $IMAGE_REPO:$NEW_TAG"
                            echo "Service: $SERVICE"
                            echo "Commit: $NEW_TAG"
                        else
                            echo "Deployment failed."

                            if rollback; then
                                echo "Previous frontend version restored."
                            else
                                echo "CRITICAL: Manual intervention may be required."
                            fi

                            exit 1
                        fi

                        REMOTE_SCRIPT
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'SUCCESS: Frontend image built, validated, pushed, and deployed.'
            echo 'The deployed Docker image is identified by its full Git commit SHA.'
        }

        failure {
            echo 'FAILED: Inspect the Jenkins Console Output.'
            echo 'If deployment started, verify the production gateway and rollback status.'
        }

        always {
            echo 'Frontend CI/CD pipeline execution completed.'
        }
    }
}