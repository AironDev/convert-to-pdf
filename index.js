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
  
  // var newFileName = Date.now()+'.pdf';
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




    try{
        const Stamp = require('commonpdf').Stamp,
        img = 'data:image/gif;base64,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',
        pdf = '/tmp/example.pdf',
        page = 1,
        dimensions = {width:100, height:100, x:100, y:100}
        
        const dataImg = 'data:image/png;base64,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';

        execSync('ls -alh /tmp').toString('utf8');

        let contract = {
        file: path.join(__dirname, '/tmp/example.pdf'),
        page: 1,
        stamps: [
            {
                uri: dataImg,
                locations: [
                    {
                        x: 140,
                        y: 490,
                        width: 200,
                        height: 75
                    },
                    {
                        x: 240,
                        y: 590,
                        width: 200,
                        height: 75
                    }
                ]
            }
        ]
    }, stamp = new Stamp(contract);
    console.log(stamp)
    stamp.write()
        .then(outFile => {
          console.log(outfile)
        // t.plan(6);
        // ['/tmp/fw9-pg_1.pdf', '/tmp/fw9-pg_2.pdf', '/tmp/fw9-pg_3.pdf', '/tmp/fw9-pg_4.pdf'].forEach(page => {
        //     t.false(fs_1.existsSync(page), 'Pages should be cleaned up at end of process.');
        // });
        // t.ok(outFile);
        // fs_1.exists(outFile, exists => {
        //     t.true(exists);
        // });
        execSync('ls -alh /opt').toString('utf8');
    }).catch((err) => {
        execSync('ls -alh /opt').toString('utf8');
        console.log('error ph' + err);
    });


    }catch(e){
      console.log("unable to add watermark" +e)
    }

};

  // console.log(fs.readFileSync(path.join(__dirname, '/tmp/example.pdf')));
 // add watermark
    // try{
    //     const Stamp = require('commonpdf').Stamp,
    //     img = 'data:image/gif;base64,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',
    //     pdf = '/tmp/example.pdf',
    //     page = 1,
    //     dimensions = {width:100, height:100, x:100, y:100}
        
    //     const dataImg = 'data:image/png;base64,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';

    //     // new Stamp(pdf).write(img, page, dimensions)    
    //     // .then(outfile => {
    //     //   return outfile
    //     //   // do something with newly stamped pdf 
    //     // })

    //     // let contract = {
    //     //     file: path.join(__dirname, '../node_modules/commonpdf_testfiles/fw9.pdf'),
    //     //     stamps: [],
    //     //     page: 1
    //     // }, stamp = new Stamp(contract);


    //     let contract = {
    //     file: path.join(__dirname, '/tmp/example.pdf'),
    //     page: 1,
    //     stamps: [
    //         {
    //             uri: dataImg,
    //             locations: [
    //                 {
    //                     x: 140,
    //                     y: 490,
    //                     width: 200,
    //                     height: 75
    //                 },
    //                 {
    //                     x: 240,
    //                     y: 590,
    //                     width: 200,
    //                     height: 75
    //                 }
    //             ]
    //         }
    //     ]
    // }, stamp = new Stamp(contract);
    // stamp.write()
    //     .then(outFile => {
    //     t.plan(6);
    //     ['/tmp/fw9-pg_1.pdf', '/tmp/fw9-pg_2.pdf', '/tmp/fw9-pg_3.pdf', '/tmp/fw9-pg_4.pdf'].forEach(page => {
    //         t.false(fs_1.existsSync(page), 'Pages should be cleaned up at end of process.');
    //     });
    //     t.ok(outFile);
    //     fs_1.exists(outFile, exists => {
    //         t.true(exists);
    //     });
    // }).catch((err) => {
    //     console.log(err);
    // });


    // }catch(e){
    //   console.log("unable to add watermark" +e)
    // }
