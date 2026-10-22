
pipeline {
    agent {
        label 'docker'
    }

    environment {
        DOCKERHUB_USER = 'ankithv007'
        IMAGE_NAME = 'ankithv007/sfcs-unit2-frontend'
        CONTAINER_NAME = 'sfcs-unit2-frontend'
        APP_PORT = '8081'
    }

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm

                sh 'git log -1 --oneline'
            }
        }

        stage('Install Dependencies and Build') {
            steps {
                sh '''
                    set -eu
                    npm ci
                    npm run build
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

                    docker build \
                        -t "$IMAGE_NAME:$IMAGE_TAG" .
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'dockerhub-token',
                        variable: 'DOCKERHUB_TOKEN'
                    )
                ]) {
                    script {
                        try {
                            sh '''
                                set -eu
                                set +x

                                printf '%s' "$DOCKERHUB_TOKEN" |
                                    docker login \
                                        --username "$DOCKERHUB_USER" \
                                        --password-stdin

                                docker push "$IMAGE_NAME:$IMAGE_TAG"
                            '''
                        } finally {
                            sh 'docker logout || true'
                        }
                    }
                }
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh '''
                    set -eu

                    docker pull "$IMAGE_NAME:$IMAGE_TAG"

                    docker rm -f "$CONTAINER_NAME" || true

                    docker run -d \
                        --name "$CONTAINER_NAME" \
                        --restart unless-stopped \
                        -p "127.0.0.1:$APP_PORT:80" \
                        "$IMAGE_NAME:$IMAGE_TAG"

                    sleep 3

                    if ! docker inspect \
                        --format='{{.State.Running}}' \
                        "$CONTAINER_NAME" | grep -qx true; then
                        docker logs "$CONTAINER_NAME" || true
                        echo "Frontend container failed to start"
                        exit 1
                    fi

                    echo "Frontend deployed successfully"
                    docker ps --filter "name=$CONTAINER_NAME"
                '''
            }
        }
    }

    post {
        success {
            echo "SFCS frontend deployed successfully: ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
        }

        failure {
            echo 'SFCS frontend pipeline failed. Check the stage logs.'
        }

        always {
            echo "Build result: ${currentBuild.currentResult}"
        }
    }
}
