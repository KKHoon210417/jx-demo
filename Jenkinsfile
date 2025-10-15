pipeline {
  agent any
  tools { nodejs 'node18' }
  stages {
    stage("Test"){steps{sh "npm ci || npm i"; sh "npm test"}}
    stage("Build"){steps{sh "echo build step (placeholder)"}}
  }
}
