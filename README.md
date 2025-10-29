https://github.com/persteenolsen/express-ejs





git config --global user.email "you@example.com"
git config --global user.name "Your Name"


docker ps -a


To build image
docker build -t news-server-api .


To run image
docker run -p 8080:3000 -d --name my-express-container news-server-api

/*
docker run --rm -p 8080:3000 --name my-express-container news-server-api
You run: docker stop my-express-container
Docker sends a signal to the running container, telling it to stop (exit).

Because the container was started with the --rm flag, the moment it exits, Docker automatically executes the equivalent of docker rm my-express-container for you.

Result: The old container instance is automatically removed from your system. You only ran the stop command.
/*


docker stop my-express-container

docker rm my-express-container



901741122726.dkr.ecr.ap-south-1.amazonaws.com/news-server-api
//*

after aws config in local (FULL ADMIN ACCESS IF YOU ARE NEW TO IAM)

aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 901741122726.dkr.ecr.ap-south-1.amazonaws.com


aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 901741122726.dkr.ecr.ap-south-1.amazonaws.com


3. Build the Docker Image

In your project folder (where Dockerfile and index.js exist):

docker build -t news-server-api .


4. Tag the Image for ECR
docker tag news-server-api:latest 901741122726.dkr.ecr.ap-south-1.amazonaws.com/news-server-api:latest


5. Push the Image to ECR
docker push 901741122726.dkr.ecr.ap-south-1.amazonaws.com/news-server-api:latest


6. Verify the Image in ECR
aws ecr list-images --repository-name news-server-api

//*