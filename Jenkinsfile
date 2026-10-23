pipeline {
    agent any

    environment {
        DOCKERHUB_USER = 'ankithbv007'
        IMAGE_NAME     = 'ankithbv007/sfcs-unit2-frontend'
        CONTAINER_NAME = 'sfcs-unit2-frontend'
        APP_PORT       = '8081'
    }

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm

                sh '''
                    set -eu
                    echo "=== Latest Commit ==="
                    git log -1 --oneline
                '''
            }
        }

        stage('Check Build Environment') {
            steps {
                sh '''
                    set -eu

                    echo "=== Agent Information ==="
                    cat /etc/os-release || true

                    echo "=== Docker ==="
                    docker --version

                    echo "=== Docker Access ==="
                    docker info >/dev/null

                    echo "Docker is accessible from the Jenkins agent."
                '''
            }
        }

        stage('Install Dependencies and Build') {
            steps {
                sh '''
                    set -eu

                    docker run --rm \
                        --user "$(id -u):$(id -g)" \
                        -v "$WORKSPACE:/app" \
                        -w /app \
                        -e HOME=/tmp \
                        node:22-alpine \
                        sh -ec '
                            echo "=== Node.js Version ==="
                            node --version

                            echo "=== npm Version ==="
                            npm --version

                            echo "=== Install Dependencies ==="
                            npm ci

                            echo "=== Build Frontend ==="
                            npm run build
                        '
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    env.IMAGE_TAG = env.BUILD_NUMBER
                }

                sh '''
                    set -eu

                    echo "Building image: $IMAGE_NAME:$IMAGE_TAG"

                    docker build \
                        -t "$IMAGE_NAME:$IMAGE_TAG" \
                        .
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-token',
                        usernameVariable: 'DOCKERHUB_USER',
                        passwordVariable: 'DOCKERHUB_TOKEN'
                    )
                ]) {
                    sh '''
                        set -eu
                        set +x

                        echo "$DOCKERHUB_TOKEN" |
                            docker login \
                                --username "$DOCKERHUB_USER" \
                                --password-stdin

                        docker push "$IMAGE_NAME:$IMAGE_TAG"

                        docker logout
                    '''
                }
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh '''
                    set -eu

                    echo "Pulling image: $IMAGE_NAME:$IMAGE_TAG"

                    docker pull "$IMAGE_NAME:$IMAGE_TAG"

                    # Remove the existing container only after the new
                    # image has been pulled successfully.
                    docker rm -f "$CONTAINER_NAME" || true

                    docker run -d \
                        --name "$CONTAINER_NAME" \
                        --restart unless-stopped \
                        -p "127.0.0.1:$APP_PORT:80" \
                        "$IMAGE_NAME:$IMAGE_TAG"

                    sleep 5

                    if ! docker inspect \
                        --format='{{.State.Running}}' \
                        "$CONTAINER_NAME" | grep -qx true; then

                        echo "ERROR: Frontend container failed to start."
                        docker logs "$CONTAINER_NAME" || true
                        exit 1
                    fi

                    echo "=== Running Frontend Container ==="
                    docker ps --filter "name=$CONTAINER_NAME"

                    echo "Frontend deployment completed."
                '''
            }
        }
    }

    post {
        success {
            echo "Frontend deployed successfully: ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
        }

        failure {
            echo 'Pipeline failed. Check the stage logs before retrying.'
        }

        always {
            echo "Build result: ${currentBuild.currentResult}"
        }
    }
}
