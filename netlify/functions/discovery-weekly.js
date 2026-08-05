const { scanDiscovery } = require('./_discovery-engine');
exports.handler=async()=>{try{const result=await scanDiscovery();console.log('Weekly discovery',result);return {statusCode:200,body:JSON.stringify(result)}}catch(e){console.error('Weekly discovery failed',e);return {statusCode:500,body:JSON.stringify({error:e.message})}}};
