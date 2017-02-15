var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var express = require('express');
var jimp = require('jimp');
var fs = require('fs');
var router = express.Router();
var knox = require('knox');
AWS.config.loadFromPath('./config.json');
var s3Service = new AWS.S3();
var sqsService = new AWS.SQS();
var dbService = new AWS.SimpleDB();

var bucketName = 'rusek-bucket';
var domainName = 'AWSRusek';
var queueURL = 'https://sqs.us-west-2.amazonaws.com/983680736795/RusekSQS';
var prefix = 'photos/';
var imageName = '';
var tempImageProcessDirectory = "/home/bitnami/TempPhotos/";
var tempImagePath = '';
var region = "us-west-2";
//nieużywane
var deletePhoto = function(photoKey) {
    var result;
    s3Service.deleteObject({ Key: photoKey }, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            putLog(err.message, new Date().toISOString(), "S3Error");
            result = false;
        } else {
            result = true;
        }
    });
    return result;
}

var processPhoto = function(key) {
    var photoKey = key;
    console.log(photoKey);
    imageName = photoKey.split("/").pop();
    console.log(imageName);
    var directory = tempImageProcessDirectory;
    var imageFullPathName = directory + imageName;
    var imageDownloaded = fs.createWriteStream(imageFullPathName);
    console.log(imageDownloaded.path);
    tempImagePath = imageDownloaded.path;
    var fullKey = prefix + imageName;
    console.log(fullKey);
    var params = {
        Bucket: bucketName,
        Key: fullKey
    };
    var downloadStream;

    downloadStream = s3Service.getObject(params).createReadStream().pipe(imageDownloaded).on('error', function() {
        console.log("error while downloading object " + fullKey + '');
        putLog(error.message, new Date().toISOString(), "DownloadError");
        imageDownloaded.end();
    });
    downloadStream.on('finish', function(err, res) {
        imageDownloaded.end();
        if (err) {
            console.log(err, err.stack);
            putLog(err.message, new Date().toISOString(), "S3Error");
        } else {
            console.log(tempImagePath);
            if (imageFullPathName != '') {
                jimp.read(imageFullPathName, function(error, img) {
                    if (error) {
                        console.log(error.message);
                        putLog(error.message, new DateTime().toISOString, "ProcessingError");
                    } else {
                        img.rotate(90).write(imageFullPathName);
                        var fb = img.getBuffer(jimp.AUTO, function(err, buff) {
                            if (err) {
                                console.log(err.message);
                                putLog(err.message, new DateTime().toISOString(), "ProcessingError");
                            } else {
                                var metaData = 'image/*';

                                var params = {
                                    ACL: 'public-read',
                                    Bucket: bucketName,
                                    Key: fullKey,
                                    Body: buff,
                                    ContentType: metaData
                                };
                                s3Service.putObject(params, function(err, response) {
                                    if (err) {
                                        console.log(err.message);
                                        putLog(err.message, new Date().toISOString(), "S3Error");
                                    } else {
                                        putLog("Object " + fullKey + " has been rotated.", new Date().toISOString(), "ProcessInfo");
                                    }

                                });
                            }
                        });
                    }
                });
            } else {
                putLog("No object rotated", new Date().toISOString(), "StreamError");
            }
        }
    });
}

var putLog = function(message, timestamp, errCode) {
    var params = {
        Attributes: [{
                Name: 'LogTime',
                Value: timestamp,
                Replace: true || false
            },
            {
                Name: 'Code',
                Value: errCode,
                Replace: true || false
            },
            {
                Name: 'Message',
                Value: message,
                Replace: true || false
            },
        ],
        DomainName: domainName,
        ItemName: uuid.v1()
    };
    dbService.putAttributes(params, function(err, data) {
        if (err) console.log(err, err.stack);
    });
}

//NIEUŻYWANE
var getMessageFromQueue = function() {
    var params = {
        MaxNumberOfMessages: 10,
        QueueUrl: queueURL,
        VisibilityTimeout: 0
    };

    sqsService.receiveMessage(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            putLog(err.message, new Date().toISOString(), "SQSError");
        } else {
            var deleteParams = {
                QueueUrl: queueURL,
                ReceiptHandle: data.Messages[0].ReceiptHandle
            };
            sqsService.deleteMessage(deleteParams, function(err, data) {
                if (err) {
                    console.log("Delete Error", err);
                } else {
                    console.log("Message Deleted", data);
                }
            });
        }
    });
}

var putMesagesToQueue = function(photoKeys) {

    var entries = [];
    photoKeys.each(function(item) {
        Entries.push('{MessageBody: ' + item + ' }');
    });
    var params = {
        DelaySeconds: 0,
        Entries: entries,
        QueueUrl: queueURL
    };
    var result = sqsService.sendMessageBatch(params, function(err, data) {
        if (err) {
            console.log(err.message, err.stack);
            putLog(err.message, new Date().toISOString(), "SQSError");
            return false;
        } else {
            console.log("Success put to queue", data.MessageId);
            putLog("Image has been put to queue", new Date().toISOString(), "SQSInfo");
            return true;
        }
    });
    return result;
}

exports.deletePhoto = deletePhoto;
exports.processPhoto = processPhoto;
exports.putLog = putLog;
exports.putMesagesToQueue = putMesagesToQueue;