var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var express = require('express');
var jimp = require('jimp');
var fs = require('fs');
var router = express.Router();
var knox = require('knox');
AWS.config.loadFromPath('./config.json');
var promisePipe = require("promisepipe");

var bucketName = 'rusek-bucket';
var domainName = 'AWSRusek';
var queueURL = 'https://sqs.us-west-2.amazonaws.com/983680736795/RusekSQS';
var prefix = 'photos/';
var tempImageProcessDirectory = "/home/bitnami/TempPhotos/";
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
    var tempImagePath = '';
    var imageName = '';
    var fullKey = key;
    imageName = fullKey.split("/").pop();
    console.log(imageName);
    var directory = tempImageProcessDirectory;
    var imageFullPathName = directory + imageName;
    var imageDownloaded = fs.createWriteStream(imageFullPathName);
    console.log(imageDownloaded.path);
    tempImagePath = imageDownloaded.path;
    console.log(fullKey);
    var params = {
        Bucket: bucketName,
        Key: fullKey
    };
    var s3Service = new AWS.S3();
    var downloadStream = s3Service.getObject(params).createReadStream().pipe(imageDownloaded);

    downloadStream.on('finish', function(err, elem) {
        if (err) {
            putLog(err.message, new Date().toISOString(), "DownloadError");
        } else {
            console.log("download finished");
            console.log(tempImagePath);
            if (imageFullPathName != '') {
                jimp.read(imageFullPathName, function(err, img) {
                    if (err) {
                        putLog(err.message, new Date().toISOString(), "JIMPError");
                    } else {
                        console.log("read finished");
                        img.rotate(90).write(imageFullPathName, function(errorr, dat) {
                            if (errorr) {
                                putLog(errorr.message, new Date().toISOString(), "JIMPError");
                            } else {
                                var fb = fs.readFile(imageFullPathName, function(err, buff) {
                                    if (err) {
                                        console.log(err.message);
                                        putLog(err.message, new DateTime().toISOString(), "ProcessingError");
                                    } else {
                                        console.log("rotate finished");
                                        var metaData = 'image/*';

                                        var params = {
                                            ACL: 'public-read',
                                            Bucket: bucketName,
                                            Key: fullKey,
                                            Body: buff,
                                            ContentType: metaData
                                        };
                                        s3Service.putObject(params, function(err, response) {
                                            fs.unlink(imageFullPathName);
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
    var dbService = new AWS.SimpleDB();
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
    console.log(photoKeys);
    var entries = new Array();
    photoKeys.forEach(function(element) {
        var item = new Object();
        item.DelaySeconds = 0;
        item.Id = uuid.v1();
        item.MessageBody = element;
        entries.push(item);
    }, this);
    console.log(JSON.stringify(entries));
    var params = {
        Entries: entries,
        QueueUrl: queueURL
    };
    var sqsService = new AWS.SQS();
    var result = sqsService.sendMessageBatch(params, function(err, data) {
        if (err) {
            console.log(err.message, err.stack);
            putLog(err.message, new Date().toISOString(), "SQSError");
            return false;
        } else {
            console.log("Success put to queue");
            putLog("Images has been put to queue", new Date().toISOString(), "SQSInfo");
            return true;
        }
    });
    return result;
}

exports.deletePhoto = deletePhoto;
exports.processPhoto = processPhoto;
exports.putLog = putLog;
exports.putMesagesToQueue = putMesagesToQueue;