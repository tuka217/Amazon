var amazon = require('./AmazonHelper');
var Consumer = require('sqs-consumer');
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');

var queueURL = 'https://sqs.us-west-2.amazonaws.com/983680736795/RusekSQS';

var app = Consumer.create({
    batchSize: 10,
    queueUrl: queueURL,
    handleMessage: function(message, done) {
        var key = message.Body;
        amazon.processPhoto(key);
        console.log("done for key " + key + '');
        done();
    },
    sqs: new AWS.SQS()
});

app.on('error', function(err) {
    console.log(err.message);
    amazon.putLog(err.message, new Date().toISOString(), "SQSWorkerError");
});

app.start();
console.log("listening for messages on url:" + queueURL);