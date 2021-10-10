const path = require('path');
const fs = require('fs');
var async = require('async');
const {writeFileSync} = require('fs');
const lambdafs = require('lambdafs');
const {execSync} = require('child_process');
const {S3} = require('aws-sdk');

const inputPath = path.join( '/opt', 'lo.tar.br'); 
const outputPath = '/tmp/';
const bucketName = process.env.SOURCE_BUCKET;

module.exports.handler = async ({url, Records} ) => {
execSync('ls -alh /opt').toString('utf8');
  try {
    // Decompressing
    let decompressed = {
      file: await lambdafs.inflate(inputPath)
    };
    console.log('Success brotli decompressed'); 
  } catch (error) {
    console.log('Error brotli de:----', error);
  }
 
  try {
    execSync('ls -alh /opt'); 
  } catch (e) {
    console.log(e);
  }

  // get file from s3 bucketvd
  if(Records){
    console.log('Object Event running ' + Records.toString('utf8')); 
    var records = Records
    var s3fileName = decodeURIComponent( records[0].s3.object.key.replace(/\+/g, ' '));
    console.log('Object Event running ' + s3fileName); 
  }else{
    var s3fileName = filename;
    console.log('Manual event triggered ' + s3fileName); 
    console.log(event)
  }
  
  console.log('s3 bucket file name from event:', s3fileName);


  var newFileName = Date.now()+'.pdf';
  const s3 = new S3();
  var fileStream = fs.createWriteStream('/tmp/'+s3fileName);

  var getObject = function(keyFile) {
      return new Promise(function(success, reject) {
          s3.getObject(
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
      s3.putObject({
       Body: buffer,
       Key: fileName,
       Bucket: process.env.DESTINATION_BUCKET,
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
    await uploadFile(fileB64data, fileParts);
    console.log('new pdf converted and uploaded!!!');

    // Host-Style Naming: http://mybucket.s3-us-west-2.amazonaws.com
    // Path-Style Naming: http://s3-us-west-2.amazonaws.com/mybucket
    let uploadedFileUrl =  `http://s3-eu-west-2.amazonaws.com/${DESTINATION_BUCKET}/${fileParts}`
    console.log(uploadedFileUrl);
    return uploadedFileUrl

    // return `https://s3.amazonaws.com/${process.env.DESTINATION_BUCKET}/${fileParts}`;

    
};