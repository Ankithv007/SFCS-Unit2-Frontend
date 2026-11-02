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
        IMAGE_REPO = 'ankithbv007/sfcs-unit2-frontend'
        DOCKERHUB_CREDS = 'dockerhub-token'
        APP_HOST = '139.84.217.224'
        APP_DIR = '/opt/sfcs-unit2'
        SSH_CREDS = 'sfcs-production-ssh'
        COMPOSE_SERVICE = 'gateway'
        TAG_KEY = 'FRONTEND_TAG'
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

                    echo "Source files verified."
                '''
            }
        }

        stage('Validate Environment') {
            steps {
                sh '''
                    set -eu

                    echo "Checking Docker..."

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

                    echo "Building React/Vite frontend..."

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

                    IMAGE="$IMAGE_REPO:$GIT_COMMIT_FULL"
                    BUILD_CONTEXT="$(mktemp -d)"

                    trap 'rm -rf "$BUILD_CONTEXT"' EXIT

                    echo "Building image: $IMAGE"

                    mkdir -p "$BUILD_CONTEXT/site"

                    cp -a dist/. "$BUILD_CONTEXT/site/"
                    cp nginx.conf "$BUILD_CONTEXT/nginx.conf"

                    docker build \
                        --pull \
                        --label "org.opencontainers.image.title=SFCS-Frontend" \
                        --label "org.opencontainers.image.revision=$GIT_COMMIT_FULL" \
                        --label "org.opencontainers.image.source=https://github.com/Ankithv007/SFCS-Unit2-Frontend" \
                        --tag "$IMAGE" \
                        -f- "$BUILD_CONTEXT" <<'DOCKERFILE'
FROM nginx:alpine

# Install this Nginx configuration fragment inside the http context.
# nginx.conf must contain valid upstream and server directives, without
# outer events {} or http {} blocks.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install the built React/Vite frontend.
COPY site/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE

                    echo "Image built successfully: $IMAGE"
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

                    echo "Step 1: Validate Nginx syntax inside the frontend image..."

                    # Production API routes are supplied by the gateway's read-only
                    # host mount: /opt/sfcs-unit2/nginx.conf. They do not need to
                    # exist in the standalone frontend image's Nginx configuration.
                    docker run --rm "$IMAGE" nginx -t

                    echo "Nginx syntax validation passed."
                    echo "Step 2: Start a temporary frontend smoke-test container..."

                    docker run -d \
                        --name "$SMOKE_NAME" \
                        -p "127.0.0.1:$SMOKE_PORT:80" \
                        "$IMAGE" >/dev/null

                    HEALTHY=0

                    echo "Step 3: Check that the frontend returns HTTP success..."

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
                        echo "ERROR: Frontend smoke test failed."
                        exit 1
                    fi

                    echo "Frontend smoke test passed."
                    echo "Docker image validation successful."
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: env.DOCKERHUB_CREDS,
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

                        echo "Pushing commit-tagged image: $IMAGE"

                        docker push "$IMAGE"

                        echo "Image pushed successfully."
                    '''
                }
            }
        }

        stage('Deploy to Production') {
            steps {
                script {
                    if (!env.APP_HOST?.trim()) {
                        error(
                            'APP_HOST is empty. Set it to the production server IP or hostname.'
                        )
                    }
                }

                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: env.SSH_CREDS,
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )
                ]) {
                    sh '''
                        set -eu

                        echo "======================================"
                        echo "Production Deployment"
                        echo "======================================"
                        echo "Server: $APP_HOST"
                        echo "Directory: $APP_DIR"
                        echo "Service: $COMPOSE_SERVICE"
                        echo "Image: $IMAGE_REPO:$GIT_COMMIT_FULL"

                        test -r "$SSH_KEY"

                        if [ -z "$(printf '%s' "$SSH_USER" | tr -d '[:space:]')" ]; then
                            echo "ERROR: SSH username from Jenkins credentials is empty."
                            exit 1
                        fi

                        echo "SSH username supplied by Jenkins: [$SSH_USER]"
                        echo "Checking SSH private-key format..."

                        ssh-keygen -y -f "$SSH_KEY" >/dev/null

                        ssh \
                            -i "$SSH_KEY" \
                            -o IdentitiesOnly=yes \
                            -o PubkeyAuthentication=yes \
                            -o PreferredAuthentications=publickey \
                            -o PasswordAuthentication=no \
                            -o BatchMode=yes \
                            -o StrictHostKeyChecking=yes \
                            -o ConnectTimeout=15 \
                            "${SSH_USER}@${APP_HOST}" \
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
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
LOCK_FILE="$APP_DIR/.deploy.lock"

test -f "$ENV_FILE"
test -f "$COMPOSE_FILE"

command -v docker >/dev/null 2>&1 || {
    echo "ERROR: Docker is not installed or not in PATH."
    exit 1
}

docker compose version >/dev/null 2>&1 || {
    echo "ERROR: Docker Compose v2 is not available."
    exit 1
}

command -v flock >/dev/null 2>&1 || {
    echo "ERROR: flock is required for deployment locking."
    exit 1
}

command -v curl >/dev/null 2>&1 || {
    echo "ERROR: curl is required for production health checks."
    exit 1
}

if [[ ! "$TAG_KEY" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
    echo "ERROR: Invalid environment variable name."
    exit 1
fi

exec 9>"$LOCK_FILE"

if ! flock -w 300 9; then
    echo "ERROR: Could not acquire deployment lock."
    exit 1
fi

echo "Deployment lock acquired."

if [[ ! "$NEW_TAG" =~ ^[0-9a-f]{40}$ ]]; then
    echo "ERROR: Invalid Git commit SHA."
    exit 1
fi

if ! grep -q "^${TAG_KEY}=" "$ENV_FILE"; then
    echo "ERROR: $TAG_KEY is missing from .env."
    exit 1
fi

TAG_COUNT="$(grep -c "^${TAG_KEY}=" "$ENV_FILE")"

if [ "$TAG_COUNT" -ne 1 ]; then
    echo "ERROR: Expected exactly one $TAG_KEY entry in .env; found $TAG_COUNT."
    exit 1
fi

OLD_TAG="$(grep "^${TAG_KEY}=" "$ENV_FILE" | cut -d '=' -f 2-)"
ROLLBACK_AVAILABLE=0

if [[ "$OLD_TAG" =~ ^[0-9a-f]{40}$ ]]; then
    ROLLBACK_AVAILABLE=1
    echo "Previous commit-tagged image: $OLD_TAG"
else
    echo "WARNING: Current tag '$OLD_TAG' is a legacy/non-commit tag."
    echo "A verified commit-tag rollback target is not available."
    echo "Automatic rollback may be unavailable if deployment fails."
fi

echo "New image tag: $NEW_TAG"

update_tag() {
    python3 - "$ENV_FILE" "$TAG_KEY" "$1" <<'PY'
import os
import stat
import sys
import tempfile

path, key, value = sys.argv[1:4]
prefix = key + "="

with open(path, "r", encoding="utf-8") as source:
    lines = source.read().splitlines()

updated = []
found = False

for line in lines:
    if line.startswith(prefix):
        if not found:
            updated.append("{}={}".format(key, value))
            found = True
    else:
        updated.append(line)

if not found:
    raise SystemExit("Missing required variable: " + key)

directory = os.path.dirname(path) or "."
original_stat = os.stat(path)

fd, temp_path = tempfile.mkstemp(
    prefix=".env.",
    dir=directory,
    text=True
)

try:
    with os.fdopen(fd, "w", encoding="utf-8") as destination:
        destination.write(chr(10).join(updated) + chr(10))
        destination.flush()
        os.fsync(destination.fileno())

    os.chown(temp_path, original_stat.st_uid, original_stat.st_gid)
    os.chmod(temp_path, stat.S_IMODE(original_stat.st_mode))
    os.replace(temp_path, path)

except Exception:
    try:
        os.unlink(temp_path)
    except FileNotFoundError:
        pass
    raise
PY
}

deploy_new() {
    echo "Pulling the exact new image before changing production configuration..."

    if ! docker pull "$IMAGE_REPO:$NEW_TAG"; then
        echo "ERROR: Could not pull the new image."
        echo "Production configuration is unchanged."
        return 1
    fi

    echo "Updating production image tag..."

    if ! update_tag "$NEW_TAG"; then
        echo "ERROR: Could not update frontend tag."
        return 1
    fi

    if ! docker compose -f "$COMPOSE_FILE" config -q; then
        echo "ERROR: Docker Compose configuration is invalid."
        return 1
    fi

    echo "Pulling the exact commit-tagged image..."

    if ! docker compose -f "$COMPOSE_FILE" pull "$SERVICE"; then
        echo "ERROR: Failed to pull the new image."
        return 1
    fi

    echo "Recreating only the gateway service..."

    if ! docker compose -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE"; then
        echo "ERROR: Gateway deployment failed."
        return 1
    fi

    echo "Waiting for production health checks..."

    for attempt in $(seq 1 30); do
        if docker compose -f "$COMPOSE_FILE" ps --status running --services "$SERVICE" |
            grep -Fxq "$SERVICE"; then

            if curl --fail --silent --show-error --max-time 5 \
                http://127.0.0.1:8081/ -o /dev/null; then

                echo "Production HTTP health check passed."
                return 0
            fi
        fi

        echo "Health check attempt $attempt failed."
        sleep 3
    done

    echo "ERROR: New gateway failed its health checks."
    docker compose -f "$COMPOSE_FILE" logs --tail=100 "$SERVICE" || true

    return 1
}

rollback() {
    echo "Attempting rollback to image tag: $OLD_TAG"

    if ! update_tag "$OLD_TAG"; then
        echo "CRITICAL: Failed to restore the previous tag."
        return 1
    fi

    if ! docker compose -f "$COMPOSE_FILE" config -q; then
        echo "CRITICAL: Compose validation failed during rollback."
        return 1
    fi

    if ! docker compose -f "$COMPOSE_FILE" pull "$SERVICE"; then
        echo "WARNING: Could not pull the previous image."
        echo "Compose will try to use the previously cached image."
    fi

    if ! docker compose -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE"; then
        echo "CRITICAL: Failed to restore the previous gateway."
        return 1
    fi

    for attempt in $(seq 1 20); do
        if docker compose -f "$COMPOSE_FILE" ps --status running --services "$SERVICE" |
            grep -Fxq "$SERVICE"; then

            if curl --fail --silent --max-time 5 \
                http://127.0.0.1:8081/ -o /dev/null; then

                echo "Rollback successful."
                return 0
            fi
        fi

        sleep 3
    done

    echo "CRITICAL: Rollback health check failed."
    docker compose -f "$COMPOSE_FILE" logs --tail=100 "$SERVICE" || true

    return 1
}

if deploy_new; then
    echo "======================================"
    echo "FRONTEND DEPLOYMENT SUCCESSFUL"
    echo "======================================"
    echo "Image: $IMAGE_REPO:$NEW_TAG"
    echo "Commit: $NEW_TAG"
    echo "Service: $SERVICE"
else
    echo "Deployment failed."

    if [ "$ROLLBACK_AVAILABLE" -eq 1 ]; then
        echo "Starting rollback to the previous commit-tagged image..."

        if rollback; then
            echo "Previous frontend version restored."
        else
            echo "CRITICAL: Rollback could not be verified."
            echo "Manual investigation is required."
        fi
    else
        echo "CRITICAL: No verified previous image is available for rollback."
        echo "The new tag remains in .env."
        echo "Check gateway logs and container status."

        docker compose -f "$COMPOSE_FILE" ps "$SERVICE" || true
        docker compose -f "$COMPOSE_FILE" logs --tail=100 "$SERVICE" || true

        echo "Manual recovery is required before another deployment."
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
            echo 'The production image is identified by its full Git commit SHA.'
        }

        failure {
            echo 'FAILED: Inspect the Jenkins Console Output.'
            echo 'If deployment started, check the gateway and rollback status.'
        }

        always {
            echo 'Frontend CI/CD pipeline execution completed.'
        }
    }
}