import { ConvexError } from "convex/values";
import { PORTAL_PLAN } from "./portalBilling";

export const STRIPE_API_VERSION="2026-10-28.endive";
export type StripeData=Record<string,any>;
export function billingConfiguration() {
  const key=process.env.STRIPE_SECRET_KEY;
  const priceId=process.env.STRIPE_MONTHLY_PRICE_ID;
  const appUrl=process.env.APP_URL;
  if(!key||!priceId||!appUrl||!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new ConvexError("Os pagamentos ainda não estão disponíveis. Tente novamente mais tarde.");
  }
  if (!/^price_[a-zA-Z0-9]+$/.test(priceId)) {
    console.error("Stripe configuration: STRIPE_MONTHLY_PRICE_ID must be a price_ ID, not a product ID or payment link.");
    throw new ConvexError({code:"STRIPE_PRICE_CONFIGURATION",message:"O plano de pagamento não está configurado corretamente. Entre em contato com o suporte."});
  }
  const url=new URL(appUrl);
  if(url.protocol!=="https:" && !(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname))) throw new Error("APP_URL must use HTTPS");
  return {key,priceId,appUrl:url.origin};
}

export async function stripeRequest(path:string, body?:Record<string,string>, idempotencyKey?:string):Promise<StripeData> {
  const {key}=billingConfiguration();
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{
    method:body?"POST":"GET",headers:{Authorization:`Bearer ${key}`,"Stripe-Version":STRIPE_API_VERSION,
      ...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{}),...(idempotencyKey?{"Idempotency-Key":idempotencyKey}:{})},
    ...(body?{body:new URLSearchParams(body).toString()}:{}),signal:AbortSignal.timeout(20000)
  });
  if(!response.ok) {
    const payload=await response.json().catch(()=>null);
    const error=payload?.error;
    // Log diagnostic fields only; never log authorization, request bodies or raw errors.
    console.error("Stripe API request failed",{
      resource:path.split(/[/?]/)[0],status:response.status,
      code:typeof error?.code==="string"?error.code:undefined,
      param:typeof error?.param==="string"?error.param:undefined,
      requestId:response.headers.get("request-id")
    });
    if (body?.["discounts[0][promotion_code]"] && response.status===400 &&
      (String(error?.param??"").startsWith("discounts") || /coupon|promotion/.test(String(error?.code??"")))) {
      throw new ConvexError({code:"STRIPE_COUPON_REJECTED",message:"Este cupom não pode ser aplicado à assinatura. Verifique as condições ou tente outro código."});
    }
    if (path.startsWith("prices/") && response.status===404) {
      throw new ConvexError({code:"STRIPE_PRICE_NOT_FOUND",message:"O plano de pagamento não foi encontrado. Entre em contato com o suporte."});
    }
    throw new ConvexError({code:"STRIPE_REQUEST_FAILED",message:"Não foi possível concluir a operação de pagamento. Tente novamente."});
  }
  return response.json();
}
export const stripeId=(value:any):string|undefined=>typeof value==="string"?value:typeof value?.id==="string"?value.id:undefined;
export function validPortalPrice(price:StripeData) {
  return price.id===process.env.STRIPE_MONTHLY_PRICE_ID && price.currency===PORTAL_PLAN.currency && price.unit_amount===PORTAL_PLAN.amount &&
    price.recurring?.interval===PORTAL_PLAN.interval && price.recurring?.interval_count===1 && !price.deleted;
}

export async function subscriptionSnapshot(subscriptionId:string) {
  const checkedAt=Date.now();
  const sub=await stripeRequest(`subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=latest_invoice`);
  const item=sub.items?.data?.length===1?sub.items.data[0]:null;
  const price=item && typeof item.price==="object"?item.price:null;
  const valid=price && item.quantity===1 && validPortalPrice(price);
  const currentPeriodEnd=Number(item?.current_period_end??sub.current_period_end)*1000;
  let invoice=sub.latest_invoice;
  if(typeof invoice==="string") invoice=await stripeRequest(`invoices/${encodeURIComponent(invoice)}`);
  const invoiceSubscription=stripeId(invoice?.parent?.subscription_details?.subscription??invoice?.subscription);
  let paidThrough:number|undefined;
  if(valid&&invoice?.status==="paid"&&invoice.currency==="brl"&&invoiceSubscription===sub.id) {
    const lines=invoice.lines?.data??[];
    const ends=lines.filter((line:StripeData)=>stripeId(line.pricing?.price_details?.price??line.price)===price.id && line.amount>=0)
      .map((line:StripeData)=>Number(line.period?.end)*1000).filter((end:number)=>Number.isFinite(end)&&end>0);
    if(ends.length&&Number.isFinite(currentPeriodEnd)) paidThrough=Math.min(Math.max(...ends),currentPeriodEnd);
  }
  return {
    subscriptionId:sub.id as string,customerId:stripeId(sub.customer)!,
    status:valid?String(sub.status):"invalid_plan",priceId:valid?String(price.id):undefined,
    paidThrough,currentPeriodEnd:Number.isFinite(currentPeriodEnd)?currentPeriodEnd:undefined,
    cancelAtPeriodEnd:Boolean(sub.cancel_at_period_end),checkedAt,
    billingAccountId:sub.metadata?.billingAccountId as string|undefined
  };
}

export async function verifyStripeSignature(body:string,header:string,secret:string,now=Date.now()) {
  const values=header.split(",").map(part=>part.trim().split("="));
  const timestamp=Number(values.find(([key])=>key==="t")?.[1]);
  const signatures=values.filter(([key,value])=>key==="v1"&&/^[0-9a-f]{64}$/i.test(value??"")).map(([,value])=>value);
  if(!Number.isSafeInteger(timestamp)||Math.abs(now/1000-timestamp)>300||!signatures.length) return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  const message=new TextEncoder().encode(`${timestamp}.${body}`);
  for(const signature of signatures) {
    const bytes=Uint8Array.from(signature.match(/../g)!,value=>parseInt(value,16));
    if(await crypto.subtle.verify("HMAC",key,bytes,message)) return true;
  }
  return false;
}
