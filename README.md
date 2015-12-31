# metrics-rest-service
a nodjs rest service to sit inbetween IFTTT like recipes and Elasticsearch

Status: work in progress, isn't anywhere close to working yet


## This is a fork of node-js-getting-started

This all started using the node.js tutorial from Heroku: [node-js-getting-started](https://github.com/heroku/node-js-getting-started), which is a barebones Node.js app using [Express 4](http://expressjs.com/).

A good intro tutorial for how that all works can be found here:  [Getting Started with Node on Heroku](https://devcenter.heroku.com/articles/getting-started-with-nodejs) 

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
$ heroku config:set SERVICE_USERNAME=<userame-for-this-rest-serivice>
$ heroku config:set SERVICE_PASSWORD=<password-for-this-rest-serivice>
$ git push heroku master
$ heroku open
```

## IFTTT rest target
URL:

```
https://<username>:<password>@<name of heroku app>.herokuapp.com/metric
```

Method: POST

Content Type: application/json

Body:

```
{
"metric_source": "ifttt",
"metric_channel": "datatype",
"checkTime": "{{CheckTime}}",
"payload": {
    << FIELDS >>
  }
}
```
