const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  const headers = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"};
  if (event.httpMethod === "OPTIONS") return {statusCode:204,headers,body:""};
  if (event.httpMethod !== "POST") return {statusCode:405,headers,body:JSON.stringify({error:"Méthode non autorisée"})};
  const user=process.env.SMTP_USER;
  const pass=process.env.SMTP_PASS;
  if(!user||!pass) return {statusCode:503,headers,body:JSON.stringify({error:"Ajoute SMTP_USER et SMTP_PASS dans Netlify > Site configuration > Environment variables"})};
  let body={};try{body=JSON.parse(event.body||"{}")}catch(e){return {statusCode:400,headers,body:JSON.stringify({error:"Requête invalide"})}}
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST||"mail.gandi.net",port:Number(process.env.SMTP_PORT||465),secure:String(process.env.SMTP_SECURE||"true")==="true",auth:{user,pass}});
  try{
    if(body.test){await transporter.verify();return {statusCode:200,headers,body:JSON.stringify({ok:true})}}
    if(!body.to||!body.subject||!body.text)return {statusCode:400,headers,body:JSON.stringify({error:"Destinataire, objet ou message manquant"})};
    const attachments=[];
    if(body.attachment && body.attachment.content && body.attachment.filename){
      const clean=String(body.attachment.content).replace(/^data:application\/pdf;base64,/,"");
      attachments.push({filename:body.attachment.filename,content:clean,encoding:"base64",contentType:"application/pdf"});
    }
    const info=await transporter.sendMail({from:`Rodolph Menten — Oligart <${user}>`,to:body.to,replyTo:user,subject:body.subject,text:body.text,attachments});
    return {statusCode:200,headers,body:JSON.stringify({ok:true,messageId:info.messageId})};
  }catch(e){console.error(e);return {statusCode:500,headers,body:JSON.stringify({error:"Échec SMTP : vérifie le mot de passe et les variables Netlify"})}}
};
