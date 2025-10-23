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