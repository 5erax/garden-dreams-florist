import nodemailer from 'nodemailer';
import {createClient} from '@supabase/supabase-js';
import {notificationHandler} from '../server/notification-handler.js';

function worker(){
const email='dha260803@gmail.com';
const client=createClient(process.env.VITE_SUPABASE_URL,process.env.ADMIN_SUPABASE_SERVICE_KEY);
const smtp=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,
 auth:{user:email,pass:(process.env.ADMIN_SMTP_PASSWORD||'').replace(/\s/g,'')},
 connectionTimeout:15000,greetingTimeout:15000,socketTimeout:15000});
async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw Error('OUTBOX_FAILED');return data;}
const handle=notificationHandler({secret:process.env.ADMIN_NOTIFICATION_SECRET,
 verify:()=>smtp.verify(),claim:()=>rpc('gd_claim_order_notifications'),
 finish:(row,state,error)=>rpc('gd_finish_order_notification',{p_order:row.id,p_lease:row.lease,p_state:state,p_error:error}),
 send:async(row)=>{
  const subject=row.test?'Garden Dreams · Thông báo đơn đã sẵn sàng':`Garden Dreams · Đơn mới ${row.reference}`;
  const text=row.test?'Đây là email kiểm tra kết nối thông báo đơn mới của Garden Dreams. Không tạo đơn thử và không ghi nhận thanh toán.':
   `Có yêu cầu đặt hoa mới: ${row.reference}\nTổng đơn: ${new Intl.NumberFormat('vi-VN').format(row.total)} đồng\nGiao: ${row.delivery_date} · ${row.delivery_time}\nĐơn đang chờ xử lý; email này không xác nhận đã nhận tiền.\nMở quản trị để xem người nhận và xác nhận lịch: https://garden-dreams-florist.vercel.app/#admin`;
  const result=await smtp.sendMail({from:`Garden Dreams <${email}>`,to:email,subject,text,
   messageId:row.test?undefined:`<garden-dreams-order-${row.id}@garden-dreams-florist.vercel.app>`});
  if(!result.accepted?.includes(email)){const error=Error('SMTP_REJECTED');error.code='EREJECTED';throw error;}
 }});
return handle;
}
export default async function(req,res){
res.setHeader("Cache-Control","no-store");
if(process.env.VERCEL_ENV!=="production")return res.status(404).end();
try{const request=new Request("https://garden-dreams-florist.vercel.app/api/order-email",{method:req.method,headers:{authorization:req.headers.authorization||""},...(["GET","HEAD"].includes(req.method)?{}:{body:typeof req.body==="string"?req.body:JSON.stringify(req.body)})});
const response=await worker()(request);res.status(response.status);res.setHeader("Content-Type","application/json");return res.send(await response.text());}catch{return res.status(502).json({error:"NOTIFICATION_FAILED"});}
}
