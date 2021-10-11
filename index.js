const path = require('path');
const fs = require('fs');
var async = require('async');
const {writeFileSync} = require('fs');
const lambdafs = require('lambdafs');
const {execSync, spawnSync, spawn} = require('child_process');
const {S3} = require('aws-sdk');

const inputPath = path.join( '/opt', 'lo.tar.br'); 
const outputPath = '/tmp/';
const bucketName = process.env.SOURCE_BUCKET;

module.exports.handler = async ({fileUrl, returnRaw,  Records} ) => {
execSync('ls -alh /opt').toString('utf8');
  try {
    // Decompress Libreoffice
    let decompressed = {
      file: await lambdafs.inflate(inputPath)
    };
    console.log('Success brotli decompressed'); 
  } catch (error) {
    console.log('Error brotli de:----', error);
  }
  
  // get file from s3 bucket
  if(Records){
    console.log('Object Event running ' + Records.toString('utf8')); 
    var records = Records
    var s3fileName = decodeURIComponent( records[0].s3.object.key.replace(/\+/g, ' '));
    console.log('S3 triggered Event running ' + s3fileName); 
  }else{
    var s3fileName = fileUrl;
    console.log('Manual event triggered ' + s3fileName); 
  }
  
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
  // store file to be converted inside lambda tmp
  let fileData = await getObject(s3fileName);
    try{  
      fs.writeFileSync('/tmp/'+s3fileName, fileData.Body);
    } catch(err) {
      // An error occurred
      console.error('file write:', err);
    }

    // execute file conversion
    const convertCommand = `export HOME=/tmp && /tmp/lo/instdir/program/soffice.bin --headless --norestore --invisible --nodefault --nofirststartwizard --nolockcheck --nologo --convert-to "pdf:writer_pdf_Export" --outdir /tmp /tmp/${s3fileName}`;
    try {
      console.log(execSync(convertCommand).toString('utf8'));
    } catch (e) {
      console.log(execSync(convertCommand).toString('utf8'));
      console.log('Error occurred while converting document ' + e);
    }
    // console log  contents of /tmp
    console.log(execSync('ls -alh /tmp').toString('utf8'));



    // upload converted document to s3
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

    // add watermark
    try{
        const Stamp = require('commonpdf').Stamp,
        img = 'data:image/gif;base64,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',
        pdf = '/tmp/'+fileParts,
        pageNumber = 1,
        dimensions = {width:100, height:100, x:100, y:100}
     
        new Stamp(pdf).write(img, pageNumber, dimensions)    
        .then(outfile => {
          return outfile
          // do something with newly stamped pdf 
        })

    }catch(e){
      console.log("unable to add watermark" +e)
    }

    if(returnRaw){
      return fileB64data
    }else{
      await uploadFile(fileB64data, fileParts);
       // Host-Style Naming: http://mybucket.s3-us-west-2.amazonaws.com
      // Path-Style Naming: http://s3-us-west-2.amazonaws.com/mybucket
      // https://authoran-files.s3.eu-west-2.amazonaws.com/example.pdf
      let uploadedFileUrl =  `https://${process.env.DESTINATION_BUCKET}.s3-${process.env.DESTINATION_BUCKET_REGION}.amazonaws.com/${fileParts}`
      console.log('new pdf converted and uploaded!!! ' + uploadedFileUrl);
      return uploadedFileUrl
    }  
};