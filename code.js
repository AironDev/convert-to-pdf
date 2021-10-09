const path = require('path');
const fs = require('fs');
var async = require('async');
const {writeFileSync} = require('fs');
const lambdafs = require('lambdafs');
const {execSync} = require('child_process');
const {S3} = require('aws-sdk');


const inputPath = path.join( '/opt', 'lo.tar.br'); 
const outputPath = '/tmp/';
const bucketName = 'authoran-files';

module.exports.handler = async ({filename}) => {
  console.log(execSync('ls -alh /opt').toString('utf8'));

  try {
    // Decompressing
    let decompressed = {
      file: await lambdafs.inflate(inputPath)
    };
 
    console.log('output brotli de:----', decompressed); 
  } catch (error) {
    console.log('Error brotli de:----', error);
  }
 
  try {
    console.log(execSync('ls -alh /opt').toString('utf8')); 
  } catch (e) {
    console.log(e);
  }

  var body = "";
  // S3 put event
  // body = event.Records[0].body;
  // body = 'example.docx';
  // const filename = decodeURIComponent(event.Records[0].S3.object.key.replace(/\+/g, ' '));
  console.log('S3 bucket file name from event:', filename);

  // get file from S3 bucket
  var s3fileName = filename;
  var newFileName = Date.now()+'.pdf';
  var S3 = new AWS.S3({apiVersion: '2006-03-01'});
  var fileStream = fs.createWriteStream('/tmp/'+s3fileName);

  var getObject = function(keyFile) {
      return new Promise(function(success, reject) {
          S3.getObject(
              { Bucket: bucketName, Key: keyFile },
              function (error, data) {
                  if(error) {
                      reject(error);
                  } else {
                      success(data);
                  }
              }
          );
      });
  }

  let fileData = await getObject(s3fileName);
    try{  
      fs.writeFileSync('/tmp/'+s3fileName, fileData.Body);
    } catch(err) {
      // An error occurred
      console.error('file write:', err);
    }

    const convertCommand = `export HOME=/tmp && /tmp/lo/instdir/program/soffice.bin --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to "pdf:writer_pdf_Export" --outdir /tmp /tmp/${s3fileName}`;
    try {
      console.log(execSync(convertCommand).toString('utf8'));
    } catch (e) {
      console.log(execSync(convertCommand).toString('utf8'));
    }
    console.log(execSync('ls -alh /tmp').toString('utf8'));

    function uploadFile(buffer, fileName) {
     return new Promise((resolve, reject) => {
      S3.putObject({
       Body: buffer,
       Key: fileName,
       Bucket: bucketName,
      }, (error) => {
       if (error) {
        reject(error);
       } else {

        resolve(fileName);
       }
      });
     });
    }


    let fileParts = s3fileName.substr(0, s3fileName.lastIndexOf(".")) + ".pdf";
    let fileB64data = fs.readFileSync('/tmp/'+fileParts);
    await uploadFile(fileB64data, 'pdf/'+fileParts);
    console.log('new pdf converted and uploaded!!!');
};