pipeline {
  agent any
  tools { nodejs 'node24' }
  stages {
    stage("Test"){steps{sh "npm ci || npm i"; sh "npm test"}}
    stage("Build"){steps{sh 'echo "build TEST step (placeholder)"'}}
  }
}
