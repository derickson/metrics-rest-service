# metrics-rest-service
a nodjs rest service to sit inbetween IFTTT like recipes and Elasticsearch


# node-js-getting-started

A barebones Node.js app using [Express 4](http://expressjs.com/).

This application supports the [Getting Started with Node on Heroku](https://devcenter.heroku.com/articles/getting-started-with-nodejs) article - check it out.

## Running Locally

Make sure you have [Node.js](http://nodejs.org/) and the [Heroku Toolbelt](https://toolbelt.heroku.com/) installed.

```sh
$ git clone https://github.com/derickson/metrics-rest-service.git # or clone your own fork
$ cd metrics-rest-service
$ npm install
$ npm start
```

## Deploying to Heroku

```
$ heroku create
$ heroku config:set ES_HOST=https://<username>:<password>@<hostname-for-found-instance>.found.io:<port>
$ git push heroku master
$ heroku open
```