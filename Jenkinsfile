pipeline {
    agent any

    environment {
        DOCKERHUB_USER = 'ankithbv007'
        IMAGE_NAME     = 'ankithbv007/sfcs-unit2-frontend'
        CONTAINER_NAME = 'sfcs-unit2-frontend'
        APP_PORT       = '8081'
        CANDIDATE_PORT = '18081'
        DEPLOY_DIR     = '/opt/sfcs/frontend'
    }

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh '''
                    set -eu
                    echo "=== Commit ==="
                    git log -1 --oneline
                    test -f package.json
                    test -f package-lock.json
                    test -f Dockerfile
                '''
            }
        }

        stage('Check Environment') {
            steps {
                sh '''
                    set -eu
                    docker --version
                    docker info >/dev/null
                    command -v curl
                    echo "Docker and curl are available."
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
                            npm ci
                            npm run build
                            test -f dist/index.html
                            echo "Frontend build validation passed."
                        '
                '''
            }
        }

        stage('Build Candidate Image') {
            steps {
                script {
                    // Image tagging happens only after checkout/build checks pass.
                    def shortCommit = (env.GIT_COMMIT ?: 'unknown').take(7)
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${shortCommit}"
                }
                sh '''
                    set -eu
                    echo "Building candidate image: $IMAGE_NAME:$IMAGE_TAG"
                    docker build --pull -t "$IMAGE_NAME:$IMAGE_TAG" .
                    docker image inspect "$IMAGE_NAME:$IMAGE_TAG" >/dev/null
                '''
            }
        }

        stage('Candidate HTTP Smoke Test') {
            steps {
                sh '''
                    set -eu
                    CANDIDATE_NAME="${CONTAINER_NAME}-candidate-${BUILD_NUMBER}"
                    cleanup_candidate() {
                        docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true
                    }
                    trap cleanup_candidate EXIT

                    docker run -d \
                        --name "$CANDIDATE_NAME" \
                        -p "127.0.0.1:$CANDIDATE_PORT:80" \
                        "$IMAGE_NAME:$IMAGE_TAG"

                    HEALTHY=false
                    for attempt in $(seq 1 15); do
                        if curl --fail --silent \
                            "http://127.0.0.1:$CANDIDATE_PORT/" >/dev/null 2>&1; then
                            HEALTHY=true
                            break
                        fi

                        if ! docker inspect --format='{{.State.Running}}' \
                            "$CANDIDATE_NAME" 2>/dev/null | grep -qx true; then
                            break
                        fi
                        sleep 2
                    done

                    if [ "$HEALTHY" != true ]; then
                        echo "ERROR: Candidate container did not pass HTTP check."
                        docker ps -a --filter "name=$CANDIDATE_NAME" || true
                        docker logs "$CANDIDATE_NAME" || true
                        exit 1
                    fi

                    echo "Candidate image passed HTTP smoke test."
                '''
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh '''
                    set -eu
                    install -d -m 0750 "$DEPLOY_DIR"
                    ROLLBACK_NAME="${CONTAINER_NAME}-rollback-${BUILD_NUMBER}"
                    HAD_OLD=false
                    NEW_STARTED=false

                    # Keep the previous container available for rollback.
                    if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
                        docker stop "$CONTAINER_NAME"
                        docker rename "$CONTAINER_NAME" "$ROLLBACK_NAME"
                        HAD_OLD=true
                    fi

                    if docker run -d \
                        --name "$CONTAINER_NAME" \
                        --restart unless-stopped \
                        -p "127.0.0.1:$APP_PORT:80" \
                        "$IMAGE_NAME:$IMAGE_TAG"; then
                        NEW_STARTED=true
                    fi

                    HEALTHY=false
                    if [ "$NEW_STARTED" = true ]; then
                        for attempt in $(seq 1 15); do
                            if curl --fail --silent \
                                "http://127.0.0.1:$APP_PORT/" >/dev/null 2>&1; then
                                HEALTHY=true
                                break
                            fi

                            if ! docker inspect --format='{{.State.Running}}' \
                                "$CONTAINER_NAME" 2>/dev/null | grep -qx true; then
                                break
                            fi
                            sleep 2
                        done
                    fi

                    if [ "$HEALTHY" != true ]; then
                        echo "ERROR: Deployed container failed HTTP health check."
                        docker logs "$CONTAINER_NAME" || true
                        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

                        if [ "$HAD_OLD" = true ]; then
                            docker rename "$ROLLBACK_NAME" "$CONTAINER_NAME"
                            docker start "$CONTAINER_NAME"
                            echo "Previous container restarted."
                        fi
                        exit 1
                    fi

                    if [ "$HAD_OLD" = true ]; then
                        docker rm "$ROLLBACK_NAME"
                    fi

                    docker ps --filter "name=$CONTAINER_NAME"
                    echo "Frontend HTTP health check passed."
                '''
            }
        }

        stage('Push Verified Image to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-token',
                        usernameVariable: 'REGISTRY_USER',
                        passwordVariable: 'REGISTRY_TOKEN'
                    )
                ]) {
                    sh '''
                        set -eu
                        set +x
                        trap 'docker logout >/dev/null 2>&1 || true' EXIT

                        echo "$REGISTRY_TOKEN" |
                            docker login --username "$REGISTRY_USER" --password-stdin

                        docker push "$IMAGE_NAME:$IMAGE_TAG"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Frontend deployed and published: ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
        }

        failure {
            echo 'Pipeline failed. Review the failed stage logs.'
            echo 'No Docker Hub image tag is pushed unless deployment and HTTP health checks succeed.'
        }

        always {
            echo "Build result: ${currentBuild.currentResult}"
            script {
                if (env.IMAGE_TAG) {
                    sh 'docker image rm "$IMAGE_NAME:$IMAGE_TAG" >/dev/null 2>&1 || true'
                }
            }
        }
    }
}
