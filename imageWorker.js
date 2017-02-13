var amazon = require('./AmazonHelper');
var Consumer = require('sqs-consumer');
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');

var queueURL = 'https://sqs.us-west-2.amazonaws.com/983680736795/RusekSQS';

var app = Consumer.create({
    queueUrl: queueURL,
    handleMessage: function(message, done) {
        var key = message.Body;
        var isProcessed = amazon.processPhoto(key);
        if (isProcessed) {
            done();
        } else {
            var err = '';
            done(err);
        }
    },
    sqs: new AWS.SQS()
});

app.on('error', function(err) {
    console.log(err.message);
    amazon.putLog(err.message, new Date().toISOString(), "SQSWorkerError");
});

app.start();
console.log("listening for messages on url:" + queueURL);