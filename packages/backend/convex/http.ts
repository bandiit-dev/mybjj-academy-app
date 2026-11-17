import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyStripeSignature } from "./lib/stripeApi";

export const stripeWebhook = httpAction(async(ctx,request)=>{
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret) return new Response("Payments unavailable",{status:503});
  const signature=request.headers.get("stripe-signature");
  if(!signature) return new Response("Missing signature",{status:400});
  const body=await request.text();
  if(body.length>2_000_000) return new Response("Payload too large",{status:413});
  if(!await verifyStripeSignature(body,signature,secret)) return new Response("Invalid signature",{status:400});
  try {
    const event=JSON.parse(body);
    if(typeof event.id!=="string"||typeof event.type!=="string"||!Number.isSafeInteger(event.created)||!event.data?.object) return new Response("Invalid event",{status:400});
  } catch { return new Response("Invalid event",{status:400}); }
  try {
    await ctx.runAction(internal.stripe.processWebhook,{event:body});
    return Response.json({received:true});
  } catch {
    return new Response("Webhook processing failed",{status:500});
  }
});
const http=httpRouter();
http.route({path:"/stripe/webhook",method:"POST",handler:stripeWebhook});
export default http;
