pipeline {
  agent any
  stages {
    stage("Checkout"){steps{checkout scm}}
    stage("Test"){steps{sh "npm ci || npm i"; sh "npm test"}}
    stage("Build"){steps{sh "echo build step (placeholder)"}}
  }
}
