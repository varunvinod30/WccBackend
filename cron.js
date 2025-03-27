const cron =require('cron');
const https =require('https');

const backendUrl = 'https://wccbackend.onrender.com';
const job = new cron.CronJob('*/14 * * * *', function(){
    console.log('Restarting server');
    https.get(backendUrl,(res)=>{
        if(res.statusCode == 200){
            console.log('Server Running');
        }
        else{
            console.error(`Failed to restart :${res.statusCode}`);
        }
    })
    .on('error',(err)=>{
        console.error('Error during restart', err.message);
   });
});


module.exports = job;