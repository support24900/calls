const express = require('express');
const router = express.Router();

// Vapi server-side tool: create a personalized Shopify discount code via GraphQL
router.post('/create-discount', async (req, res) => {
  try {
    const toolCall = req.body?.message?.toolCalls?.[0];
    const args = toolCall?.function?.arguments || req.body;
    
    const customerName = (args.customerName || 'CUSTOMER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const cartTotal = parseFloat(args.cartTotal) || 0;
    
    // Smart discount tiers based on cart value
    let maxDiscount = 10;
    if (cartTotal >= 150) maxDiscount = 25;
    else if (cartTotal >= 100) maxDiscount = 20;
    else if (cartTotal >= 75) maxDiscount = 15;
    else if (cartTotal >= 50) maxDiscount = 12;
    
    const requestedPercent = Math.min(Math.max(parseInt(args.discountPercent) || 15, 5), 25);
    const finalPercent = Math.min(requestedPercent, maxDiscount);
    
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `MIRAI-${customerName.substring(0, 8)}-${finalPercent}-${randomPart}`;
    
    // Parse store URL
    const envUrl = process.env.SHOPIFY_STORE_URL || '';
    const storeMatch = envUrl.match(/store\/([^\/]+)/) || envUrl.match(/([^.]+)\.myshopify/);
    const storeName = storeMatch ? storeMatch[1] : '9dkd2w-g3';
    const storeUrl = `https://${storeName}.myshopify.com`;
    
    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    
    const mutation = `mutation {
      discountCodeBasicCreate(basicCodeDiscount: {
        title: "${code}"
        code: "${code}"
        startsAt: "${startsAt}"
        endsAt: "${endsAt}"
        usageLimit: 1
        customerGets: {
          value: { percentage: ${finalPercent / 100} }
          items: { all: true }
        }
        customerSelection: { all: true }
      }) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 1) { nodes { code } }
            }
          }
        }
        userErrors { field message }
      }
    }`;
    
    const gqlRes = await fetch(`${storeUrl}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: mutation }),
    });
    
    if (!gqlRes.ok) {
      throw new Error(`Shopify API error: ${gqlRes.status}`);
    }
    
    const gqlData = await gqlRes.json();
    const userErrors = gqlData?.data?.discountCodeBasicCreate?.userErrors || [];
    
    if (userErrors.length > 0) {
      console.error('Shopify discount errors:', JSON.stringify(userErrors));
      throw new Error(userErrors[0].message);
    }
    
    const createdCode = gqlData?.data?.discountCodeBasicCreate?.codeDiscountNode?.codeDiscount?.codes?.nodes?.[0]?.code || code;
    
    console.log(`Discount created: ${createdCode} (${finalPercent}% off) for ${customerName}, cart $${cartTotal}`);
    
    const savedAmount = (cartTotal * finalPercent / 100).toFixed(2);
    const newTotal = (cartTotal - parseFloat(savedAmount)).toFixed(2);
    
    res.json({
      results: [{
        toolCallId: toolCall?.id,
        result: JSON.stringify({
          success: true,
          code: createdCode,
          percent: finalPercent,
          savedAmount,
          newTotal,
          expiresIn: '72 hours',
          message: `Great news! I've created a special ${finalPercent}% discount just for you! Your code is ${createdCode}. That saves you $${savedAmount}, bringing your total to $${newTotal}. It's valid for the next 72 hours!`
        })
      }]
    });
    
  } catch (err) {
    console.error('Discount creation error:', err.message);
    res.json({
      results: [{
        toolCallId: req.body?.message?.toolCalls?.[0]?.id,
        result: JSON.stringify({
          success: false,
          fallbackCode: 'welcome10',
          fallbackPercent: 10,
          message: `I can offer you our welcome10 code for 10% off your order!`
        })
      }]
    });
  }
});

module.exports = router;
