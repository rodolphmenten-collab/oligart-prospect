const nodemailer = require("nodemailer");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({error:"Méthode non autorisée"}) };
  try {
    const {to,subject,text} = JSON.parse(event.body||"{}");
    if(!to || !subject || !text) return {statusCode:400,body:JSON.stringify({error:"Destinataire, objet ou message manquant"})};
    const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST||"mail.gandi.net",port:Number(process.env.SMTP_PORT||465),secure:String(process.env.SMTP_SECURE||"true")==="true",auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
    await transporter.sendMail({from:process.env.SMTP_USER,to,subject,text});
    return {statusCode:200,body:JSON.stringify({ok:true})};
  } catch(e) { return {statusCode:500,body:JSON.stringify({error:e.message||"Erreur SMTP"})}; }
};